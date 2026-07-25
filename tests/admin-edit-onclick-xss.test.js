import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// tests/frontend-esc-xss.test.js sudah memperbaiki onclick="delProduct('${p.id}','${esc(p.name)}')"
// supaya kutip tunggal di nama produk/layanan tak lagi memutus string JS. Tapi baris
// tombol Edit di sebelahnya (loadProducts/loadPricelist) memakai pola berbeda yang
// TIDAK melewati esc() sama sekali:
//   onclick='editProduct(${JSON.stringify(p)})'
//   onclick='editPrice(${JSON.stringify(h)})'
// JSON.stringify() hanya meng-escape " dan \ — TIDAK PERNAH meng-escape kutip tunggal (').
// Karena hasilnya disisipkan ke dalam atribut onclick berkutip TUNGGAL, nama produk/layanan
// yang mengandung kutip tunggal (mis. dari kolaborator admin lain atau import CSV vendor POS)
// memutus atribut itu lebih awal dan menyuntik HTML/JS bebas ke tombol Edit — bisa dipakai
// mencuri token admin dari sessionStorage('rrhc_admin'). Perbaikan: onclick sekarang hanya
// membawa id (di-esc lewat esc()), lalu editProduct(id)/editPrice(id) mencari objek aslinya
// dari cache PRODUCTS/PRICELIST — persis pola yang sudah dipakai delProduct/delPrice.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'public/js/admin.js'), 'utf8');

test('admin.js: baris tombol Edit produk tidak lagi menyisipkan JSON.stringify(objek) mentah ke onclick', () => {
  assert.ok(!/onclick='editProduct\(\$\{JSON\.stringify/.test(src),
    'pola lama (rentan XSS via kutip tunggal di nama/deskripsi produk) masih ada');
});

test('admin.js: baris tombol Edit layanan tidak lagi menyisipkan JSON.stringify(objek) mentah ke onclick', () => {
  assert.ok(!/onclick='editPrice\(\$\{JSON\.stringify/.test(src),
    'pola lama (rentan XSS via kutip tunggal di nama layanan) masih ada');
});

test('admin.js: onclick editProduct sekarang hanya membawa id yang sudah di-esc()', () => {
  assert.ok(src.includes(`onclick="editProduct('\${esc(p.id)}')"`),
    'onclick editProduct harus memakai esc(p.id), bukan objek mentah');
});

test('admin.js: onclick editPrice sekarang hanya membawa id yang sudah di-esc()', () => {
  assert.ok(src.includes(`onclick="editPrice('\${esc(h.id)}')"`),
    'onclick editPrice harus memakai esc(h.id), bukan objek mentah');
});

test('admin.js: editProduct(id)/editPrice(id) sekarang menerima id (string), bukan objek produk/layanan penuh', () => {
  assert.ok(/function editProduct\(id\)\{/.test(src),
    'editProduct harus menerima id, bukan objek p — supaya tidak ada lagi jalur yang menaruh objek mentah ke onclick');
  assert.ok(/function editPrice\(id\)\{/.test(src),
    'editPrice harus menerima id, bukan objek h — supaya tidak ada lagi jalur yang menaruh objek mentah ke onclick');
});

test('demonstrasi: pola lama bisa diputus kutip tunggal di nama, pola baru (esc(id)) tidak', () => {
  // Nama produk realistis yang mengandung kutip tunggal dan mencoba menyuntik JS,
  // persis skenario yang sudah diakui berbahaya di tests/frontend-esc-xss.test.js.
  const payloadProduct = { id: 'p1', name: `Kids' Cut`, description: '', category: '', price: 1, stock: 1 };

  // Pola LAMA (sebelum fix) — dibuktikan di sini rentan, tanpa menguji kode yang sudah dihapus:
  const oldStyleOnclick = `editProduct(${JSON.stringify(payloadProduct)})`;
  assert.ok(oldStyleOnclick.includes(`Kids'`),
    'JSON.stringify tidak meng-escape kutip tunggal — inilah akar masalahnya');

  // Pola BARU (sesudah fix): onclick cuma bawa id yang sudah di-esc(), nama produk sama
  // sekali tidak pernah mencapai atribut onclick lagi.
  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newStyleOnclick = `onclick="editProduct('${esc(payloadProduct.id)}')"`;
  assert.ok(!newStyleOnclick.includes(`Kids'`),
    'nama produk seharusnya tidak lagi muncul di atribut onclick sama sekali');
  assert.equal(newStyleOnclick, `onclick="editProduct('p1')"`);
});
