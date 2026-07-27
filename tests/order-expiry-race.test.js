import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isOrderStillExpirable, ORDER_HOLD_MS } from '../netlify/lib/data.js';

// Bug yang diperbaiki: expireStaleOrders() dulu membaca daftar order SEKALI di
// awal, menandai semua order telat bayar sebagai batal+stockReturned, lalu
// menulis & mengembalikan stok sekaligus di akhir. Netlify Blobs di sini tak
// punya compare-and-swap, jadi dua invocation (checkout & admin buka daftar
// order) yang nyaris bersamaan bisa sama-sama membaca order yang sama sebagai
// "belum stockReturned" dan sama-sama mengembalikan stoknya -> stok tercatat
// dobel. Perbaikannya memproses satu order per satu, baca ulang tepat sebelum
// menulis, dan melewati order yang ternyata SUDAH ditandai oleh invocation
// lain. isOrderStillExpirable adalah inti murni dari pengecekan "masih perlu
// diproses sekarang" itu.

const now = 1_800_000_000_000; // titik waktu tetap untuk semua test

test('order menunggu_pembayaran yang sudah lewat ORDER_HOLD_MS -> masih expirable', () => {
  const order = { status: 'menunggu_pembayaran', stockReturned: false, createdAt: now - ORDER_HOLD_MS - 1000 };
  assert.equal(isOrderStillExpirable(order, now), true);
});

test('order yang belum lewat ORDER_HOLD_MS -> belum expirable', () => {
  const order = { status: 'menunggu_pembayaran', stockReturned: false, createdAt: now - ORDER_HOLD_MS + 1000 };
  assert.equal(isOrderStillExpirable(order, now), false);
});

test('order yang stockReturned sudah true (mis. sudah ditangani invocation lain) -> dilewati', () => {
  const order = { status: 'menunggu_pembayaran', stockReturned: true, createdAt: now - ORDER_HOLD_MS - 1000 };
  assert.equal(isOrderStillExpirable(order, now), false, 'jangan kembalikan stok dua kali untuk order yang sama');
});

test('order yang statusnya sudah bukan menunggu_pembayaran -> dilewati', () => {
  for (const status of ['menunggu_verifikasi', 'diproses', 'dikirim', 'selesai', 'batal']) {
    const order = { status, stockReturned: false, createdAt: now - ORDER_HOLD_MS - 1000 };
    assert.equal(isOrderStillExpirable(order, now), false, `status ${status} tidak boleh ikut expired`);
  }
});

test('order null/undefined -> aman, dianggap tidak expirable', () => {
  assert.equal(isOrderStillExpirable(null, now), false);
  assert.equal(isOrderStillExpirable(undefined, now), false);
});
