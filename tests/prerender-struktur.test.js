import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// scripts/prerender.js menyunting public/index.html DI TEMPAT saat build.
// Saat dikembangkan, versi awalnya sempat MENGHAPUS elemen [data-slot] yang
// belum ada fotonya — akibatnya foto yang nanti diunggah lewat admin tidak
// bisa dipasang lagi oleh gallery.js sampai deploy berikutnya. Sekarang slot
// kosong hanya disembunyikan. Tes ini menjaga strukturnya tetap utuh.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = readFileSync(path.join(root, 'public/index.html'), 'utf8');
const toko = readFileSync(path.join(root, 'public/toko/index.html'), 'utf8');

const SLOT_WAJIB = [
  'hero', 'about',
  'layanan-haircut', 'layanan-coloring', 'layanan-smoothing',
  'layanan-hairspa', 'layanan-nailart', 'layanan-paket',
];

test('semua slot foto masih ada di index.html', () => {
  for (const slot of SLOT_WAJIB) {
    assert.ok(html.includes(`data-slot="${slot}"`), `slot "${slot}" hilang dari index.html`);
  }
});

test('tiap kartu layanan punya slot fotonya sendiri', () => {
  const kartu = html.match(/<div class="service-card" data-kategori="[^"]+">/g) || [];
  const foto = html.match(/<div class="service-photo" data-slot="[^"]+"/g) || [];
  assert.equal(kartu.length, 6);
  assert.equal(foto.length, 6, 'jumlah slot foto harus sama dengan jumlah kartu');
});

test('penanda prerender masih lengkap — kalau hilang, build diam-diam tidak menanam apa pun', () => {
  for (const nama of ['harga', 'layanan-schema', 'preload-hero']) {
    assert.ok(html.includes(`<!-- prerender:${nama}:mulai -->`), `penanda ${nama}:mulai hilang`);
    assert.ok(html.includes(`<!-- prerender:${nama}:selesai -->`), `penanda ${nama}:selesai hilang`);
  }
  assert.ok(toko.includes('<!-- prerender:produk-schema:mulai -->'));
  assert.ok(toko.includes('<!-- prerender:produk-schema:selesai -->'));
});

test('penanda jumlah layanan ada di tiga tempat', () => {
  const n = (html.match(/<span data-jumlah-layanan>/g) || []).length;
  assert.equal(n, 3, 'hero, section harga, dan footer');
});

test('modul render dimuat sebelum pemakainya', () => {
  assert.ok(html.indexOf('/js/pricelist-render.js') < html.indexOf('/js/pricelist.js'),
    'pricelist-render.js harus lebih dulu');
  assert.ok(html.indexOf('/js/img-cdn.js') < html.indexOf('/js/gallery.js'),
    'img-cdn.js harus lebih dulu');
});

test('H1 tidak menempel gara-gara <br> tanpa spasi', () => {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const teks = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  assert.ok(!/\w{4,}di Koja/.test(teks), `teks H1 menempel: ${teks}`);
  assert.match(teks, /kecantikan di Koja/);
});
