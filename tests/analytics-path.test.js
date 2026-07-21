import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePath } from '../netlify/lib/data.js';

// Bug yang diperbaiki: recordHit() dulu memakai `(path || '/').slice(0, 120)`
// langsung pada `path` dari body POST /api/hit — endpoint publik tanpa auth,
// dipanggil oleh beacon di setiap halaman. `ref`/`campaign` sudah dijaga di
// hit.js lewat `.toString().slice(...)`, tapi `path` dikirim mentah. Kalau
// klien kirim path bukan string (objek/angka), `.slice` di atas objek/angka
// melempar TypeError tak tertangani -> request 500, dan siapa pun bisa memicu
// ini sengaja lewat satu fetch manual ke /api/hit. normalizePath() adalah
// gerbang murni yang dites di sini; recordHit() sekarang memanggilnya.

test('string biasa -> dikembalikan apa adanya', () => {
  assert.equal(normalizePath('/toko'), '/toko');
});

test('string kosong -> fallback ke "/"', () => {
  assert.equal(normalizePath(''), '/');
});

test('undefined -> fallback ke "/"', () => {
  assert.equal(normalizePath(undefined), '/');
});

test('null -> fallback ke "/" (bukan crash)', () => {
  assert.equal(normalizePath(null), '/');
});

test('objek -> fallback ke "/" (dulu: TypeError, path.slice bukan fungsi)', () => {
  assert.equal(normalizePath({ a: 1 }), '/');
});

test('array -> fallback ke "/" (dulu: lolos diam-diam jadi key aneh)', () => {
  assert.equal(normalizePath(['x', 'y']), '/');
});

test('angka -> fallback ke "/" (dulu: TypeError, path.slice bukan fungsi)', () => {
  assert.equal(normalizePath(42), '/');
});

test('string lebih dari 120 karakter -> dipotong ke 120', () => {
  const panjang = '/produk/' + 'a'.repeat(200);
  const hasil = normalizePath(panjang);
  assert.equal(hasil.length, 120);
  assert.equal(hasil, panjang.slice(0, 120));
});
