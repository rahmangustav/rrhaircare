import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORDER_STATUSES, PROOF_UPLOADABLE_STATUSES } from '../netlify/lib/data.js';

// Bug yang diperbaiki: /api/orders/:code/proof (publik, tanpa auth) menerima
// unggahan bukti bayar tanpa mengecek status order saat ini. Siapa pun yang
// tahu/menebak kode order (RRyymmdd-XXXX, 4 hex acak) bisa memaksa order yang
// sudah "selesai"/"dikirim"/"batal" mundur lagi ke "menunggu_verifikasi".
// Untuk order "batal" ini lebih parah: applyStockTransition (data.js) akan
// memotong stok LAGI karena stoknya sudah dikembalikan saat dibatalkan.

test('PROOF_UPLOADABLE_STATUSES cuma mengizinkan status pra-verifikasi', () => {
  assert.deepEqual(
    [...PROOF_UPLOADABLE_STATUSES].sort(),
    ['menunggu_pembayaran', 'menunggu_verifikasi'].sort(),
  );
});

test('status pasca-verifikasi/batal harus ditolak endpoint upload bukti', () => {
  const blocked = ORDER_STATUSES.filter(s => !PROOF_UPLOADABLE_STATUSES.includes(s));
  assert.deepEqual([...blocked].sort(), ['batal', 'dikirim', 'diproses', 'selesai'].sort());
});

test('daftar status yang diizinkan selalu subset dari ORDER_STATUSES resmi', () => {
  for (const s of PROOF_UPLOADABLE_STATUSES) {
    assert.ok(ORDER_STATUSES.includes(s), `${s} harus terdaftar di ORDER_STATUSES`);
  }
});
