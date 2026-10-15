import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// esc() escape HTML dipakai di 3 file front-end (admin.js, cart.js, toko/index.html)
// untuk menaruh data (nama produk/layanan admin, data pesanan pelanggan) ke dalam
// markup lewat innerHTML — di situ esc() (encode & < > " ') memang cukup aman.
//
// admin.js DULU juga memakai esc() untuk menaruh nama produk/layanan ke dalam
// STRING JS BERKUTIP-TUNGGAL di atribut onclick (delProduct dengan id lalu nama
// ter-escape), dan bahkan menyisipkan hasil JSON.stringify() dari objek produk
// MENTAH (tanpa escape sama sekali) langsung ke atribut onclick berkutip-tunggal
// milik editProduct. Keduanya TETAP TIDAK AMAN:
// - JSON.stringify() mentah: satu kutip tunggal saja di nama/kategori/deskripsi
//   produk memutus atribut onclick='...' di tengah (delimiter atribut itu sendiri
//   adalah kutip tunggal) -> injeksi atribut/markup bebas.
// - esc(p.name) meng-encode kutip tunggal jadi `&#39;`: ini terlihat aman di
//   SUMBER HTML, tapi browser MEN-DECODE character reference di nilai atribut
//   (termasuk atribut event handler seperti onclick) SEBELUM string itu
//   dikompilasi jadi kode JS. Jadi `&#39;` balik lagi jadi kutip tunggal mentah
//   persis saat handler dieksekusi, dan JS bebas tetap bisa disuntik & jalan di
//   sesi admin yang login — termasuk mencuri token admin dari
//   sessionStorage('rrhc_admin') untuk akses penuh API admin. esc() TIDAK
//   pernah benar-benar menutup celah ini untuk konteks onclick.
//
// Perbaikannya: onclick baris tabel produk/layanan HANYA membawa `id` (string
// aman, dibuat server — tak pernah berisi kutip/karakter HTML), lalu
// editProduct/delProduct/editPrice/delPrice mencari objek lengkapnya sendiri
// dari cache (PRODUCTS_CACHE/PRICELIST_CACHE) — nama/objek produk tak pernah
// lagi disisipkan ke dalam onclick sama sekali.
//
// Tes ini memuat SUMBER ASLI tiap file (bukan salinan tertulis ulang) supaya
// menguji kode yang benar-benar dikirim ke browser, bukan tebakan.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEscFromArrowLine(file, needle) {
  const src = readFileSync(path.join(root, file), 'utf8');
  const line = src.split('\n').find(l => l.includes(needle));
  assert.ok(line, `baris "${needle}" tidak ditemukan di ${file}`);
  const expr = line.trim().replace(/^const esc = /, '').replace(/;$/, '');
  return new Function('return (' + expr + ')')();
}

function loadEscFromFunctionLine(file, needle) {
  const src = readFileSync(path.join(root, file), 'utf8');
  const line = src.split('\n').find(l => l.includes(needle));
  assert.ok(line, `baris "${needle}" tidak ditemukan di ${file}`);
  return new Function('return (' + line.trim().replace(/^function /, 'function ') + ')')();
}

const targets = [
  ['public/js/admin.js', () => loadEscFromArrowLine('public/js/admin.js', 'const esc = s =>')],
  ['public/js/cart.js', () => loadEscFromFunctionLine('public/js/cart.js', 'function esc(s)')],
  ['public/toko/index.html', () => loadEscFromFunctionLine('public/toko/index.html', 'function esc(s)')],
];

for (const [file, load] of targets) {
  test(`${file}: esc() meng-escape kelima karakter HTML/JS-string berbahaya`, () => {
    const esc = load();
    assert.equal(esc(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  });

  test(`${file}: esc() tidak mengubah teks biasa`, () => {
    const esc = load();
    assert.equal(esc('Serum Rambut 100ml'), 'Serum Rambut 100ml');
  });

  test(`${file}: esc() tidak throw untuk null/undefined`, () => {
    const esc = load();
    assert.doesNotThrow(() => esc(null));
    assert.doesNotThrow(() => esc(undefined));
  });
}

function readAdminJs() {
  return readFileSync(path.join(root, 'public/js/admin.js'), 'utf8');
}

test('admin.js: baris tabel produk tidak lagi menyisipkan JSON.stringify(p) mentah ke onclick', () => {
  const src = readAdminJs();
  assert.ok(!/onclick='editProduct\(\$\{JSON\.stringify/.test(src),
    'editProduct tidak boleh dipanggil dengan objek produk mentah lewat JSON.stringify di onclick');
  assert.ok(/onclick="editProduct\('\$\{p\.id\}'\)"/.test(src),
    'onclick editProduct harus cuma membawa p.id (string aman dari server)');
});

test('admin.js: baris tabel produk tidak lagi menyisipkan nama produk (walau ter-escape) ke onclick delProduct', () => {
  const src = readAdminJs();
  assert.ok(!/delProduct\('\$\{p\.id\}','\$\{esc\(p\.name\)\}'\)/.test(src),
    'delProduct tidak boleh membawa nama produk di onclick — esc() tidak melindungi konteks ini (browser men-decode entity sebelum menjalankan handler)');
  assert.ok(/onclick="delProduct\('\$\{p\.id\}'\)"/.test(src),
    'onclick delProduct harus cuma membawa p.id');
});

test('admin.js: editProduct/delProduct kini menerima id lalu mencari objeknya dari cache, bukan objek/nama mentah', () => {
  const src = readAdminJs();
  assert.ok(/function editProduct\(id\)\{/.test(src) || /function editProduct\(id\) *\{/.test(src),
    'editProduct harus menerima id, bukan objek produk mentah');
  assert.ok(/async function delProduct\(id\)\{/.test(src) || /async function delProduct\(id\) *\{/.test(src),
    'delProduct harus menerima id saja, bukan (id,name)');
  assert.ok(src.includes('PRODUCTS_CACHE'), 'harus ada cache produk untuk lookup by id');
});

test('admin.js: baris tabel layanan (pricelist) tidak lagi menyisipkan JSON.stringify(h) mentah ke onclick', () => {
  const src = readAdminJs();
  assert.ok(!/onclick='editPrice\(\$\{JSON\.stringify/.test(src),
    'editPrice tidak boleh dipanggil dengan objek layanan mentah lewat JSON.stringify di onclick');
  assert.ok(/onclick="editPrice\('\$\{h\.id\}'\)"/.test(src),
    'onclick editPrice harus cuma membawa h.id');
});

test('admin.js: baris tabel layanan tidak lagi menyisipkan nama layanan (walau ter-escape) ke onclick delPrice', () => {
  const src = readAdminJs();
  assert.ok(!/delPrice\('\$\{h\.id\}','\$\{esc\(h\.name\)\}'\)/.test(src),
    'delPrice tidak boleh membawa nama layanan di onclick — esc() tidak melindungi konteks ini');
  assert.ok(/onclick="delPrice\('\$\{h\.id\}'\)"/.test(src),
    'onclick delPrice harus cuma membawa h.id');
  assert.ok(src.includes('PRICELIST_CACHE'), 'harus ada cache pricelist untuk lookup by id');
});

test('esc() tetap dipakai untuk teks biasa (mis. innerHTML) — itu konteks yang aman', () => {
  const esc = loadEscFromArrowLine('public/js/admin.js', 'const esc = s =>');
  // Untuk teks node biasa (bukan atribut JS-string), meng-encode &<>"' tetap
  // cukup dan tidak berbahaya untuk ditinggalkan di jalur innerHTML lain
  // (mis. <td>${esc(p.name)}</td>) — bukan itu yang jadi masalah di sini.
  assert.equal(esc(`x'); alert(1); //`), `x&#39;); alert(1); //`);
});
