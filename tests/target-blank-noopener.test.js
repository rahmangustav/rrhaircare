import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Bug yang diperbaiki: banyak tautan `target="_blank"` di situs ini (tombol WA
// booking/karir/lokasi/footer, sosial media footer, tombol "Lihat Toko" di
// admin, tombol "Kirim Bukti"/"Chat Pembeli" di admin.js) dibuka tanpa
// `rel="noopener"`. Tanpa itu, halaman tujuan yang dibuka di tab baru
// mendapat akses `window.opener` ke tab asal dan bisa mengarahkannya
// (window.opener.location = ...) ke halaman phishing — reverse tabnabbing
// (CWE-1022). Paling berisiko di admin.js: link "Chat Pembeli"/"Bukti bayar"
// dibuka dari tab admin yang sedang login (token di sessionStorage) — kalau
// tab asalnya dialihkan diam-diam ke klon halaman login admin, admin bisa
// tertipu memasukkan ulang password di sana. Semua `target="_blank"` di
// situs ini sekarang WAJIB disertai `rel="noopener` di tag yang sama.
//
// Tes ini memindai SUMBER ASLI tiap file (bukan salinan tertulis ulang),
// termasuk markup yang dirakit lewat template literal JS di admin.js.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Ambil semua tag pembuka <a ...> dari teks sumber (HTML biasa maupun yang
// dirakit lewat template literal JS) — cukup untuk memeriksa atribut target/rel
// tanpa perlu parser HTML penuh.
function findAnchorTags(src) {
  return src.match(/<a\b[^>]*>/g) || [];
}

const FILES_WITH_EXPECTED_BLANK_LINKS = [
  ['public/index.html', 12],
  ['public/admin.html', 1],
  ['public/checkout.html', 1],
  ['public/js/admin.js', 2],
];

for (const [file, expectedCount] of FILES_WITH_EXPECTED_BLANK_LINKS) {
  test(`${file}: setiap target="_blank" disertai rel="noopener"`, () => {
    const src = readFileSync(path.join(root, file), 'utf8');
    const tags = findAnchorTags(src).filter(t => t.includes('target="_blank"'));
    // Pastikan file ini memang masih punya tautan target="_blank" yang relevan
    // untuk diuji (kalau berubah drastis, tes ini harus disesuaikan, bukan lolos diam-diam).
    assert.equal(tags.length, expectedCount,
      `jumlah tag <a target="_blank"> di ${file} berubah dari yang diharapkan — cek juga rel="noopener"-nya`);
    for (const tag of tags) {
      assert.match(tag, /rel="[^"]*noopener/,
        `tag berikut membuka tab baru tanpa rel="noopener" (celah reverse tabnabbing): ${tag}`);
    }
  });
}

test('tidak ada regresi: rel="noopener" yang ditambahkan tidak menghapus atribut lain di tag yang sama', () => {
  const src = readFileSync(path.join(root, 'public/js/admin.js'), 'utf8');
  const proofLink = findAnchorTags(src).find(t => t.includes('paymentProof'));
  assert.ok(proofLink, 'tag link bukti bayar tidak ditemukan');
  assert.match(proofLink, /href="\$\{o\.paymentProof\}"/);
  assert.match(proofLink, /rel="noopener noreferrer"/);
});
