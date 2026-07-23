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

// Bug yang diperbaiki: price/stock dulu cuma `Number(x) || 0` — form admin
// (public/admin.html) sudah punya `min="0"`, tapi itu validasi client yang
// gampang dilewati (DevTools/panggilan API langsung dengan token admin sah).
// `Number("-500")` bernilai -500 (truthy), jadi `|| 0` tidak menahan harga
// negatif -> orders.js menghitung `subtotal += p.price * qty`, sehingga satu
// produk berharga negatif mengurangi total checkout, bukan cuma salah tampil.

test('price negatif -> dipaksa jadi 0 (POST tambah produk)', () => {
  const fields = buildProductFields({ name: 'Sampo', price: -50000 });
  assert.equal(fields.price, 0);
});

test('stock negatif -> dipaksa jadi 0', () => {
  const fields = buildProductFields({ name: 'Sampo', stock: -5 });
  assert.equal(fields.stock, 0);
});

test('price bukan angka (string sampah) -> dipaksa jadi 0, bukan NaN', () => {
  const fields = buildProductFields({ name: 'Sampo', price: 'gratis' });
  assert.equal(fields.price, 0);
});

test('price/stock tidak dikirim (PUT parsial) -> field TIDAK disertakan, tidak menimpa nilai lama', () => {
  const fields = buildProductFields({ name: 'Sampo' });
  assert.equal('price' in fields, false);
  assert.equal('stock' in fields, false);
});

test('price 0 eksplisit tetap disertakan sebagai 0 (bukan diperlakukan seperti tidak dikirim)', () => {
  const fields = buildProductFields({ name: 'Sampo', price: 0 });
  assert.equal('price' in fields, true);
  assert.equal(fields.price, 0);
});
