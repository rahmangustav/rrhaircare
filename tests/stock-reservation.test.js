import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStockReservation } from '../netlify/lib/data.js';

// Bug yang diperbaiki: orders.js dulu mengecek stok dari satu snapshot `products`
// lalu, di akhir request yang sama, menulis kembali pengurangan dari snapshot itu
// juga — tanpa membaca ulang. Antara pengecekan dan penulisan ada jeda (I/O Blobs
// lain: expireStaleOrders, addOrder), jadi dua order yang datang nyaris bersamaan
// untuk unit terakhir sebuah produk bisa sama-sama lolos pengecekan dan sama-sama
// menulis stok berkurang -> stok jadi minus (kelas bug: TOCTOU / lost update).
// applyStockReservation adalah inti murni dari perbaikannya: dipanggil dengan
// snapshot yang dibaca ULANG tepat sebelum menulis (lihat reserveStockFor).

test('stok cukup untuk satu item -> dikurangi, tidak ada yang short', () => {
  const products = [{ id: 'p1', stock: 5 }];
  const short = applyStockReservation(products, [{ id: 'p1', qty: 2 }]);
  assert.deepEqual(short, []);
  assert.equal(products[0].stock, 3);
});

test('stok pas habis (qty == stock) -> tetap lolos, stok jadi 0', () => {
  const products = [{ id: 'p1', stock: 3 }];
  const short = applyStockReservation(products, [{ id: 'p1', qty: 3 }]);
  assert.deepEqual(short, []);
  assert.equal(products[0].stock, 0);
});

test('stok tidak cukup -> ditandai short, snapshot TIDAK diubah', () => {
  const products = [{ id: 'p1', stock: 1 }];
  const short = applyStockReservation(products, [{ id: 'p1', qty: 2 }]);
  assert.deepEqual(short, ['p1']);
  assert.equal(products[0].stock, 1, 'stok tidak boleh berubah kalau reservasi gagal');
});

test('produk tidak ditemukan -> ditandai short', () => {
  const products = [{ id: 'p1', stock: 5 }];
  const short = applyStockReservation(products, [{ id: 'lain', qty: 1 }]);
  assert.deepEqual(short, ['lain']);
});

test('order multi-item, satu item short -> GAGAL SEBAGAI SATU UNIT, tidak ada pengurangan parsial', () => {
  const products = [{ id: 'p1', stock: 10 }, { id: 'p2', stock: 1 }];
  const short = applyStockReservation(products, [{ id: 'p1', qty: 2 }, { id: 'p2', qty: 5 }]);
  assert.deepEqual(short, ['p2']);
  assert.equal(products[0].stock, 10, 'p1 tidak boleh ikut terpotong walau lolos sendiri');
  assert.equal(products[1].stock, 1);
});

test('order multi-item, semua cukup -> semua dikurangi', () => {
  const products = [{ id: 'p1', stock: 10 }, { id: 'p2', stock: 4 }];
  const short = applyStockReservation(products, [{ id: 'p1', qty: 2 }, { id: 'p2', qty: 4 }]);
  assert.deepEqual(short, []);
  assert.equal(products[0].stock, 8);
  assert.equal(products[1].stock, 0);
});

test('simulasi race: dua order rebutan unit terakhir -> hanya satu yang lolos', () => {
  // Simulasi reserveStockFor: setiap order membaca ULANG snapshot (bukan snapshot
  // basi dari awal request) tepat sebelum applyStockReservation, persis pola fix ini.
  const store = [{ id: 'p1', stock: 1 }];
  const readFresh = () => store.map(p => ({ ...p })); // baca ulang, salinan independen

  const snapshotA = readFresh();
  const shortA = applyStockReservation(snapshotA, [{ id: 'p1', qty: 1 }]);
  if (!shortA.length) store[0].stock = snapshotA[0].stock; // simulasi saveProducts

  const snapshotB = readFresh();
  const shortB = applyStockReservation(snapshotB, [{ id: 'p1', qty: 1 }]);
  if (!shortB.length) store[0].stock = snapshotB[0].stock;

  assert.deepEqual(shortA, [], 'order pertama harus lolos');
  assert.deepEqual(shortB, ['p1'], 'order kedua harus gagal karena stok sudah habis');
  assert.equal(store[0].stock, 0, 'stok akhir tidak boleh minus');
});

test('qty non-angka/kosong diperlakukan sebagai 0 (tidak crash, tidak mengurangi stok)', () => {
  const products = [{ id: 'p1', stock: 5 }];
  const short = applyStockReservation(products, [{ id: 'p1', qty: 'abc' }]);
  assert.deepEqual(short, []);
  assert.equal(products[0].stock, 5);
});
