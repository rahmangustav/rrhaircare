import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyProductPatch } from '../netlify/lib/data.js';

// Bug yang diperbaiki: addProduct() sudah menjaga NaN lewat `Number(p.price) || 0`,
// tapi updateProduct() dulu memakai `Number(patch.price)` polos tanpa fallback.
// Kalau patch.price/stock bukan angka valid (mis. payload API admin yang salah
// bentuk, bukan lewat form HTML number yang biasanya sudah tervalidasi browser),
// hasilnya NaN — dan JSON.stringify() mengubah NaN jadi `null`, diam-diam
// mengosongkan harga/stok produk yang tersimpan.

test('applyProductPatch: price non-numerik tidak boleh jadi NaN/null, jatuh ke 0', () => {
  const existing = { id: 'p_1', name: 'Sampo Anti Rontok', price: 45000, stock: 10 };
  const next = applyProductPatch(existing, { price: 'abc' });
  assert.equal(Number.isNaN(next.price), false, 'harga tidak boleh NaN');
  assert.equal(next.price, 0);
  assert.equal(JSON.parse(JSON.stringify(next)).price, 0, 'tidak boleh berubah jadi null saat disimpan');
});

test('applyProductPatch: stock non-numerik tidak boleh jadi NaN/null, jatuh ke 0', () => {
  const existing = { id: 'p_2', name: 'Vitamin Rambut', price: 30000, stock: 20 };
  const next = applyProductPatch(existing, { stock: 'xyz' });
  assert.equal(Number.isNaN(next.stock), false, 'stok tidak boleh NaN');
  assert.equal(next.stock, 0);
});

test('applyProductPatch: price/stock numerik valid tetap tersimpan seperti biasa', () => {
  const existing = { id: 'p_3', name: 'Serum', price: 50000, stock: 5 };
  const next = applyProductPatch(existing, { price: 75000, stock: 8 });
  assert.equal(next.price, 75000);
  assert.equal(next.stock, 8);
});

test('applyProductPatch: price/stock tidak dikirim -> nilai lama tetap dipakai', () => {
  const existing = { id: 'p_4', name: 'Kondisioner', price: 40000, stock: 12 };
  const next = applyProductPatch(existing, { name: 'Kondisioner Baru' });
  assert.equal(next.price, 40000);
  assert.equal(next.stock, 12);
  assert.equal(next.name, 'Kondisioner Baru');
});
