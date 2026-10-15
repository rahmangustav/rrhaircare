import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveMedia } from '../netlify/lib/data.js';

// Bug yang diperbaiki: admin-settings.js (ganti QRIS) dan admin-products.js
// (ganti foto produk) tidak mengecek hasil saveMedia() sebelum menghapus/
// menimpa gambar lama. saveMedia() balikin '' (bukan throw) untuk format
// yang tak didukung (mis. SVG, sengaja diblokir karena bisa memuat <script>).
// Tanpa guard di handler, upload dengan tipe tak didukung menghapus QRIS/foto
// produk lama secara diam-diam sambil merespons seolah sukses. Test ini
// mengunci kontrak saveMedia() yang jadi dasar guard tersebut: input yang
// tak lolos SELALU balikin '' (tanpa menyentuh Blobs), bukan lolos diam-diam.

test('tipe tak didukung (SVG) -> string kosong, bukan URL', async () => {
  const svgDataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
  assert.equal(await saveMedia(svgDataUrl), '');
});

test('tipe tak dikenal (bmp) -> string kosong', async () => {
  const bmpDataUrl = 'data:image/bmp;base64,Qk0=';
  assert.equal(await saveMedia(bmpDataUrl), '');
});

test('bukan data URL sama sekali -> string kosong, tidak throw', async () => {
  assert.equal(await saveMedia('bukan-data-url'), '');
});

test('data URL kosong/undefined -> string kosong, tidak throw', async () => {
  assert.equal(await saveMedia(''), '');
  assert.equal(await saveMedia(undefined), '');
});
