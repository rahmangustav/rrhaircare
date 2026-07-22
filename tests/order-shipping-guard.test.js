import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveShipping } from '../netlify/lib/data.js';

// Bug yang diperbaiki: orders.js dulu mencocokkan shippingId klien ke
// settings.shippingOptions lalu, kalau tak ada yang cocok, diam-diam jatuh ke
// { label: '-', price: 0 } — bukan menolak request. Endpoint /api/orders bisa
// dipanggil langsung (bukan lewat form checkout), jadi shippingId sembarangan
// atau kosong bisa membuat order lolos dengan ongkir Rp0 walau seharusnya
// berbayar. resolveShipping adalah inti murni dari perbaikannya: mengembalikan
// null kalau id tak dikenal, supaya orders.js bisa menolak dengan 400.

const OPTIONS = [
  { id: 'jabodetabek', label: 'Jabodetabek', price: 15000 },
  { id: 'jawa', label: 'Pulau Jawa (luar Jabodetabek)', price: 25000 },
  { id: 'luarjawa', label: 'Luar Pulau Jawa', price: 40000 },
  { id: 'ambil', label: 'Ambil di salon (Koja) — gratis', price: 0 },
];

test('id yang cocok -> mengembalikan opsi ongkir itu', () => {
  assert.deepEqual(resolveShipping(OPTIONS, 'jawa'), OPTIONS[1]);
});

test('opsi gratis yang sah (ambil di salon) tetap dikenali, bukan ditolak', () => {
  assert.deepEqual(resolveShipping(OPTIONS, 'ambil'), OPTIONS[3]);
});

test('id tak dikenal -> null (harus ditolak orders.js, bukan fallback gratis)', () => {
  assert.equal(resolveShipping(OPTIONS, 'ongkir-ngarang'), null);
});

test('id kosong -> null', () => {
  assert.equal(resolveShipping(OPTIONS, ''), null);
});

test('shippingId tidak dikirim (undefined) -> null', () => {
  assert.equal(resolveShipping(OPTIONS, undefined), null);
});

test('shippingOptions belum diset (undefined/kosong) -> selalu null', () => {
  assert.equal(resolveShipping(undefined, 'jawa'), null);
  assert.equal(resolveShipping([], 'jawa'), null);
});
