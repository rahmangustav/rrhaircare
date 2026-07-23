import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeShippingOptions, resolveShipping } from '../netlify/lib/data.js';

// Bug yang diperbaiki: admin-settings.js dulu menyimpan b.shippingOptions
// mentah dari body PUT tanpa validasi. UI admin sudah Number()-kan price
// sebelum kirim, tapi endpoint bisa dipanggil langsung dengan token admin sah
// (curl/devtools) — price non-numerik atau hilang lolos tersimpan, lalu
// orders.js (`subtotal + ship.price`) menghasilkan penggabungan string atau
// NaN pada total order. sanitizeShippingOptions menutup celah itu di titik
// tulis (server), bukan cuma di client.

test('price string non-numerik dipaksa jadi 0, bukan lolos apa adanya', () => {
  const out = sanitizeShippingOptions([{ id: 'z1', label: 'Zona Aneh', price: '15000ekstra' }]);
  assert.deepEqual(out, [{ id: 'z1', label: 'Zona Aneh', price: 0 }]);
});

test('price hilang (undefined) dipaksa jadi 0, bukan NaN', () => {
  const out = sanitizeShippingOptions([{ id: 'z2', label: 'Tanpa harga' }]);
  assert.equal(out[0].price, 0);
  assert.ok(Number.isFinite(out[0].price));
});

test('price negatif dipaksa jadi 0', () => {
  const out = sanitizeShippingOptions([{ id: 'z3', label: 'Minus', price: -5000 }]);
  assert.equal(out[0].price, 0);
});

test('price angka valid (termasuk 0 untuk ongkir gratis) tetap dipertahankan', () => {
  const out = sanitizeShippingOptions([
    { id: 'jawa', label: 'Pulau Jawa', price: 25000 },
    { id: 'ambil', label: 'Ambil di salon', price: 0 },
  ]);
  assert.deepEqual(out, [
    { id: 'jawa', label: 'Pulau Jawa', price: 25000 },
    { id: 'ambil', label: 'Ambil di salon', price: 0 },
  ]);
});

test('price string angka murni ("25000") dikonversi jadi number, bukan dibuang', () => {
  const out = sanitizeShippingOptions([{ id: 'z4', label: 'Zona', price: '25000' }]);
  assert.deepEqual(out, [{ id: 'z4', label: 'Zona', price: 25000 }]);
});

test('opsi tanpa id atau tanpa label dibuang, bukan disimpan setengah jadi', () => {
  const out = sanitizeShippingOptions([
    { label: 'Tanpa id', price: 1000 },
    { id: 'z5', label: '', price: 1000 },
    { id: '', label: 'Id kosong', price: 1000 },
  ]);
  assert.deepEqual(out, []);
});

test('label dipangkas ke 60 karakter, id & label di-trim', () => {
  const panjang = 'x'.repeat(100);
  const out = sanitizeShippingOptions([{ id: '  z6  ', label: '  ' + panjang, price: 1000 }]);
  assert.equal(out[0].id, 'z6');
  assert.equal(out[0].label.length, 60);
});

test('input bukan array mengembalikan array kosong', () => {
  assert.deepEqual(sanitizeShippingOptions(undefined), []);
  assert.deepEqual(sanitizeShippingOptions(null), []);
  assert.deepEqual(sanitizeShippingOptions('bukan-array'), []);
});

test('hasil sanitizeShippingOptions tetap kompatibel dengan resolveShipping', () => {
  const clean = sanitizeShippingOptions([{ id: 'z1', label: 'Zona Aneh', price: '15000ekstra' }]);
  const ship = resolveShipping(clean, 'z1');
  const total = 50000 + ship.price;
  assert.equal(typeof total, 'number');
  assert.equal(total, 50000);
});
