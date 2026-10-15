import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uniqueWithRetry, generateOrderId, generateOrderCode } from '../netlify/lib/data.js';

// Bug yang diperbaiki: order.id dulu cuma 'o_' + Date.now().toString(36),
// tanpa garam acak seperti generator id lain di file yang sama (addProduct,
// addGalleryPhoto, daftar harga). Dua POST /api/orders yang diproses pada
// milidetik yang sama bisa dapat id kembar -> updateOrder/updateOrderByCode
// (findIndex, ambil kecocokan PERTAMA) bisa mengubah status pesanan yang
// salah. order.code juga tidak pernah dicek keunikannya terhadap order yang
// sudah ada di hari yang sama.

test('uniqueWithRetry: tidak ada tabrakan -> kembalikan kandidat pertama', () => {
  let calls = 0;
  const v = uniqueWithRetry(() => { calls++; return 'a'; }, ['b', 'c']);
  assert.equal(v, 'a');
  assert.equal(calls, 1);
});

test('uniqueWithRetry: kandidat pertama tabrakan -> coba lagi sampai dapat yang baru', () => {
  const candidates = ['dupe', 'dupe', 'fresh'];
  const v = uniqueWithRetry(() => candidates.shift(), ['dupe']);
  assert.equal(v, 'fresh');
  assert.deepEqual(candidates, []);
});

test('generateOrderId: berformat o_<base36><hex> dan tidak tabrakan dengan id yang sudah ada', () => {
  const first = generateOrderId([]);
  assert.match(first, /^o_[0-9a-z]+[0-9a-f]{4}$/);
  const second = generateOrderId([first]);
  assert.notEqual(second, first);
});

test('generateOrderCode: berformat RR<YYMMDD>-<HEX4> dan tidak tabrakan dengan kode yang sudah ada', () => {
  const first = generateOrderCode([]);
  assert.match(first, /^RR\d{6}-[0-9A-F]{4}$/);
  const second = generateOrderCode([first]);
  assert.notEqual(second, first);
});

test('generateOrderId/generateOrderCode: banyak panggilan berturut tetap semuanya unik', () => {
  const ids = [];
  const codes = [];
  for (let i = 0; i < 50; i++) {
    ids.push(generateOrderId(ids));
    codes.push(generateOrderCode(codes));
  }
  assert.equal(new Set(ids).size, 50);
  assert.equal(new Set(codes).size, 50);
});
