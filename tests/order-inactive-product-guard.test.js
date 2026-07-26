import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickPurchasableProduct } from '../netlify/lib/data.js';

// Bug yang diperbaiki: POST /api/orders (orders.js) mencari produk lewat
// `products.find(x => x.id === it.id)` dari getProducts() — daftar produk
// LENGKAP, tidak disaring seperti /api/products (listing publik toko) yang
// memfilter `p.active !== false`. Akibatnya, produk yang admin sengaja
// nonaktifkan (toggle "Tampilkan di toko" mati — mis. karena stok fisik
// sudah habis di luar sistem, harga salah, atau ditarik dari penjualan)
// TETAP bisa dipesan: entah lewat cart pelanggan yang sudah berisi produk itu
// sebelum disembunyikan, atau lewat panggilan langsung ke /api/orders dengan
// id produk yang diketahui/ditebak. pickPurchasableProduct adalah inti murni
// dari perbaikannya: mengembalikan null untuk produk nonaktif, persis seperti
// produk yang memang tidak ada — supaya orders.js menolaknya dengan 400.

const PRODUCTS = [
  { id: 'p1', name: 'Serum Rambut', stock: 10, price: 50000, active: true },
  { id: 'p2', name: 'Sampo Lama (ditarik)', stock: 5, price: 30000, active: false },
  { id: 'p3', name: 'Minyak Rambut', stock: 3, price: 25000 }, // tanpa field active = aktif (default lama)
];

test('produk aktif -> ditemukan dan bisa dipesan', () => {
  assert.deepEqual(pickPurchasableProduct(PRODUCTS, 'p1'), PRODUCTS[0]);
});

test('produk nonaktif (active:false) -> null, DITOLAK walau id valid & stok ada', () => {
  assert.equal(pickPurchasableProduct(PRODUCTS, 'p2'), null);
});

test('produk tanpa field active sama sekali -> tetap dianggap aktif (kompatibel data lama)', () => {
  assert.deepEqual(pickPurchasableProduct(PRODUCTS, 'p3'), PRODUCTS[2]);
});

test('id tidak ditemukan -> null, sama seperti sebelumnya', () => {
  assert.equal(pickPurchasableProduct(PRODUCTS, 'tidak-ada'), null);
});

test('daftar produk kosong/undefined -> null, tidak throw', () => {
  assert.equal(pickPurchasableProduct([], 'p1'), null);
  assert.equal(pickPurchasableProduct(undefined, 'p1'), null);
});
