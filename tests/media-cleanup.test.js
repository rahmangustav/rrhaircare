import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaKeyFromUrl } from '../netlify/lib/data.js';

// Bug yang diperbaiki: produk/foto galeri/foto situs/QRIS yang diganti atau
// dihapus tidak pernah menghapus blob gambar lama di store 'media' — setiap
// ganti foto meninggalkan sampah biner permanen di Netlify Blobs, membengkak
// tanpa batas selama toko dipakai. mediaKeyFromUrl() adalah inti murni dari
// perbaikannya: dipakai deleteMediaByUrl() untuk menentukan key blob mana
// yang aman dihapus dari URL yang tersimpan.

test('URL media sendiri -> key diekstrak', () => {
  assert.equal(mediaKeyFromUrl('/api/media/abc123.jpg'), 'abc123.jpg');
});

test('URL media dengan key kompleks (angka+hex+ekstensi)', () => {
  assert.equal(mediaKeyFromUrl('/api/media/lz3k9f2a.webp'), 'lz3k9f2a.webp');
});

test('string kosong -> tidak ada key', () => {
  assert.equal(mediaKeyFromUrl(''), '');
});

test('undefined/null -> tidak ada key, tidak throw', () => {
  assert.equal(mediaKeyFromUrl(undefined), '');
  assert.equal(mediaKeyFromUrl(null), '');
});

test('URL eksternal (bukan media kita) -> tidak ada key', () => {
  assert.equal(mediaKeyFromUrl('https://contoh.com/foto.jpg'), '');
});

test('path lain di situs sendiri (bukan /api/media/) -> tidak ada key', () => {
  assert.equal(mediaKeyFromUrl('/api/products/p1'), '');
});

test('URL dengan query string -> ditolak (bukan format persis hasil saveMedia)', () => {
  assert.equal(mediaKeyFromUrl('/api/media/abc.jpg?v=2'), '');
});

test('path traversal (segmen "/" tambahan) -> ditolak, bukan key tunggal', () => {
  assert.equal(mediaKeyFromUrl('/api/media/../settings'), '');
});

test('angka bukan string -> tidak throw, tidak ada key', () => {
  assert.equal(mediaKeyFromUrl(123), '');
});
