import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOrderQty } from '../netlify/lib/data.js';

// Bug yang diperbaiki: orders.js dulu memakai `Math.max(1, Number(it.qty) || 1)`
// untuk qty tiap item pesanan — ini memastikan qty minimal 1, tapi TIDAK
// membulatkannya jadi bilangan bulat. POST /api/orders publik bisa dipanggil
// langsung (bukan cuma lewat tombol +/- di checkout.html yang selalu kirim
// bulat) dengan qty pecahan seperti 1.7. Nilai itu lolos apa adanya dan dipakai
// untuk mengurangi stok produk, sehingga stok tersimpan permanen sebagai
// desimal (mis. "Stok: 3.3") — rusak dan tak bisa diperbaiki lewat form admin
// (cuma menerima input angka biasa), lalu terus terbawa tiap kali order itu
// dibatalkan/diaktifkan lagi. normalizeOrderQty adalah inti murni perbaikannya.

test('qty pecahan positif -> dibulatkan ke bilangan bulat terdekat', () => {
  assert.equal(normalizeOrderQty(1.7), 2);
  assert.equal(normalizeOrderQty(2.4), 2);
  assert.equal(normalizeOrderQty(2.5), 3);
});

test('qty pecahan di bawah 1 -> tetap minimal 1, bukan 0', () => {
  assert.equal(normalizeOrderQty(0.3), 1);
});

test('qty negatif atau 0 -> minimal 1', () => {
  assert.equal(normalizeOrderQty(-5), 1);
  assert.equal(normalizeOrderQty(0), 1);
});

test('qty bulat yang sudah valid -> tidak berubah', () => {
  assert.equal(normalizeOrderQty(1), 1);
  assert.equal(normalizeOrderQty(7), 7);
});

test('qty non-angka/kosong/undefined -> default 1 (bukan crash)', () => {
  assert.equal(normalizeOrderQty('abc'), 1);
  assert.equal(normalizeOrderQty(''), 1);
  assert.equal(normalizeOrderQty(undefined), 1);
  assert.equal(normalizeOrderQty(null), 1);
});

test('qty dikirim sebagai string angka pecahan -> tetap dibulatkan', () => {
  assert.equal(normalizeOrderQty('3.9'), 4);
});
