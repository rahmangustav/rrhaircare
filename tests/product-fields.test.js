import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProductFields } from '../netlify/lib/data.js';

// Bug yang diperbaiki: admin-products.js dulu menghitung `active` tanpa
// syarat (`b.active !== false && b.active !== 'false'`), yang SELALU
// bernilai boolean (tidak pernah `undefined`). Baris pembersihan PUT
// ("hapus field yang undefined agar tidak menimpa") jadi tidak pernah
// membuang `active` -> tiap PUT edit produk (mis. cuma ubah harga/stok,
// klien mana pun yang tidak mengirim `active`) diam-diam memaksa produk
// jadi aktif lagi, walau sebelumnya sengaja dinonaktifkan.

test('active tidak dikirim -> field active TIDAK disertakan (PUT tidak menimpa status sebelumnya)', () => {
  const fields = buildProductFields({ name: 'Sampo', price: 50000 });
  assert.equal('active' in fields, false);
});

test('active: false eksplisit -> disertakan sebagai false', () => {
  const fields = buildProductFields({ name: 'Sampo', active: false });
  assert.equal(fields.active, false);
});

test('active: true eksplisit -> disertakan sebagai true', () => {
  const fields = buildProductFields({ name: 'Sampo', active: true });
  assert.equal(fields.active, true);
});

test('active: "false" (string, dari form) -> tetap dianggap nonaktif', () => {
  const fields = buildProductFields({ name: 'Sampo', active: 'false' });
  assert.equal(fields.active, false);
});

test('field lain tetap terisi apa adanya', () => {
  const fields = buildProductFields({ name: 'Sampo', category: 'Rambut', price: 1000, stock: 5, description: 'x' });
  assert.equal(fields.name, 'Sampo');
  assert.equal(fields.category, 'Rambut');
  assert.equal(fields.price, 1000);
  assert.equal(fields.stock, 5);
  assert.equal(fields.description, 'x');
});
