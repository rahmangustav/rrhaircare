import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQty } from '../netlify/lib/data.js';

// Bug yang diperbaiki: orders.js dulu menghitung qty item pesanan lewat
// `Math.max(1, Number(it.qty) || 1)` — ini menolak qty non-angka/kosong/negatif
// dengan benar, tapi TIDAK memaksa hasilnya jadi bilangan bulat. UI keranjang
// (cart.js) hanya pernah mengirim integer lewat tombol +/-, tapi /api/orders
// adalah endpoint publik tanpa auth yang bisa dipanggil langsung (curl/devtools)
// dengan qty apa saja. `normalizeQty(2.7)` sebelum fix mengembalikan 2.7 apa
// adanya, lolos pengecekan stok (mis. stok 5 < 2.7 -> false, dianggap cukup)
// dan mengurangi stok blob `products` jadi pecahan permanen (mis. "4.3") —
// padahal produk toko (sampo, alat salon, dst) hanya bisa dijual per unit utuh.

test('qty pecahan -> dibulatkan ke bilangan bulat terdekat', () => {
  assert.equal(normalizeQty(2.7), 3);
  assert.equal(normalizeQty(2.4), 2);
});

test('qty pecahan mendekati nol -> tetap dijamin minimal 1', () => {
  assert.equal(normalizeQty(0.4), 1);
});

test('qty integer valid -> tidak berubah', () => {
  assert.equal(normalizeQty(1), 1);
  assert.equal(normalizeQty(7), 7);
});

test('qty negatif/nol -> diclamp ke 1', () => {
  assert.equal(normalizeQty(-5), 1);
  assert.equal(normalizeQty(0), 1);
});

test('qty non-angka/kosong/null -> fallback ke 1, tidak crash', () => {
  assert.equal(normalizeQty('abc'), 1);
  assert.equal(normalizeQty(''), 1);
  assert.equal(normalizeQty(null), 1);
  assert.equal(normalizeQty(undefined), 1);
});

test('qty string angka bulat -> diparse sebagai integer', () => {
  assert.equal(normalizeQty('4'), 4);
});
