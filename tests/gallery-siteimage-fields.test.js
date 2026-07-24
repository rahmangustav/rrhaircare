import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGalleryFields, sanitizeSiteImageKey } from '../netlify/lib/data.js';

// Bug yang diperbaiki: addGalleryPhoto() (netlify/lib/data.js) menghitung
// `caption: (p.caption || '').slice(0, 80)` tanpa `.toString()` dulu — beda
// dari semua field teks bebas lain di file yang sama (sanitizeCustomer,
// cleanPriceItem, dst) yang sudah konsisten `.toString()` sebelum `.slice()`.
// Endpoint admin-gallery.js (POST, perlu token admin) bisa dipanggil langsung
// lewat curl/devtools dengan body buatan sendiri (bukan lewat form resmi
// panel) — `caption` berupa angka/boolean/objek melempar TypeError mentah
// (500), bukan error JSON yang rapi seperti endpoint admin lain.

test('buildGalleryFields: caption berupa angka tidak crash, dikonversi ke string', () => {
  const f = buildGalleryFields({ image: '/api/media/x.jpg', caption: 123 });
  assert.equal(f.caption, '123');
});

test('buildGalleryFields: caption berupa boolean tidak crash', () => {
  const f = buildGalleryFields({ image: '/api/media/x.jpg', caption: true });
  assert.equal(f.caption, 'true');
});

test('buildGalleryFields: caption dipotong ke 80 karakter', () => {
  const huge = 'x'.repeat(200);
  const f = buildGalleryFields({ image: '/api/media/x.jpg', caption: huge });
  assert.equal(f.caption.length, 80);
});

test('buildGalleryFields: caption tidak dikirim -> string kosong, bukan crash', () => {
  const f = buildGalleryFields({ image: '/api/media/x.jpg' });
  assert.equal(f.caption, '');
});

test('buildGalleryFields: caption string normal tidak berubah', () => {
  const f = buildGalleryFields({ image: '/api/media/x.jpg', caption: 'Hasil smoothing' });
  assert.equal(f.caption, 'Hasil smoothing');
});

// Bug yang sama persis di admin-site-images.js: `const key = (b.key ||
// '').trim()` crash kalau `key` dikirim bukan string lewat panggilan API
// langsung — dipindah ke fungsi murni sanitizeSiteImageKey supaya konsisten
// dan bisa dites tanpa Blobs.

test('sanitizeSiteImageKey: key berupa angka tidak crash, dikonversi ke string', () => {
  assert.equal(sanitizeSiteImageKey(123), '123');
});

test('sanitizeSiteImageKey: key dengan spasi di tepi dipangkas', () => {
  assert.equal(sanitizeSiteImageKey('  about  '), 'about');
});

test('sanitizeSiteImageKey: key kosong/null/undefined -> string kosong', () => {
  assert.equal(sanitizeSiteImageKey(''), '');
  assert.equal(sanitizeSiteImageKey(null), '');
  assert.equal(sanitizeSiteImageKey(undefined), '');
});
