import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanPriceItem } from '../netlify/lib/data.js';

// Bug yang sama seperti buildProductFields (lihat tests/product-fields.test.js):
// harga/promo layanan dulu cuma `Number(x) || 0`, jadi harga negatif (dikirim
// lewat panggilan API langsung ke POST/PUT /api/admin/pricelist, melewati
// `min="0"` di form admin.html) lolos tersimpan dan tampil di daftar harga
// publik lewat public/js/pricelist.js (mis. "Rp -50.000").

test('price negatif -> dipaksa jadi 0', () => {
  const item = cleanPriceItem({ name: 'Creambath', price: -75000 });
  assert.equal(item.price, 0);
});

test('promo negatif -> dipaksa jadi 0', () => {
  const item = cleanPriceItem({ name: 'Creambath', price: 100000, promo: -1 });
  assert.equal(item.promo, 0);
});

test('price bukan angka -> dipaksa jadi 0, bukan NaN', () => {
  const item = cleanPriceItem({ name: 'Creambath', price: 'murah' });
  assert.equal(item.price, 0);
});

test('price/promo positif tetap apa adanya', () => {
  const item = cleanPriceItem({ name: 'Creambath', price: 100000, promo: 75000 });
  assert.equal(item.price, 100000);
  assert.equal(item.promo, 75000);
});
