import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOrderPatch } from '../netlify/lib/data.js';

// Bug yang diperbaiki: updateOrder/updateOrderByCode dulu membaca daftar order
// SEKALI di awal, lalu (untuk order yang berpindah dari/ke status "batal")
// menunggu I/O stok (restoreStockFor/deductStockFor) sebelum menulis balik
// SELURUH snapshot yang dibaca di awal tadi -- menimpa order lain (baru masuk
// lewat addOrder, atau diubah pihak lain) yang sempat ditulis di jendela waktu
// I/O stok itu. applyOrderPatch adalah inti murni dari perbaikannya: dipanggil
// dengan snapshot yang dibaca ULANG tepat sebelum menulis (lihat updateOrder),
// mengikuti pola applyStockReservation/reserveStockFor untuk race stok.

test('order ditemukan lewat predicate -> patch diterapkan, order lain di list tidak berubah', () => {
  const list = [
    { id: 'o_1', code: 'RR1', status: 'menunggu_pembayaran' },
    { id: 'o_2', code: 'RR2', status: 'diproses' },
  ];
  const { list: nextList, order } = applyOrderPatch(list, o => o.id === 'o_1', { status: 'dikirim' });
  assert.equal(order.status, 'dikirim');
  assert.equal(order.id, 'o_1');
  assert.equal(nextList[0].status, 'dikirim');
  assert.deepEqual(nextList[1], list[1]);
});

test('order tidak ditemukan -> order null, list dikembalikan apa adanya (bukan disalin/diubah)', () => {
  const list = [{ id: 'o_1', code: 'RR1', status: 'diproses' }];
  const { list: nextList, order } = applyOrderPatch(list, o => o.id === 'tak-ada', { status: 'batal' });
  assert.equal(order, null);
  assert.strictEqual(nextList, list);
});

test('mencari lewat code (updateOrderByCode) mengembalikan order yang cocok, bukan yang lain', () => {
  const list = [
    { id: 'o_1', code: 'RR1', status: 'menunggu_pembayaran' },
    { id: 'o_2', code: 'RR2', status: 'menunggu_pembayaran' },
  ];
  const { order } = applyOrderPatch(list, o => o.code === 'RR2', { paymentProof: 'x.jpg', status: 'menunggu_verifikasi' });
  assert.equal(order.id, 'o_2');
  assert.equal(order.paymentProof, 'x.jpg');
  assert.equal(order.status, 'menunggu_verifikasi');
});

test('patch digabung (merge) ke order asli, field yang tak disebut patch tetap dipertahankan', () => {
  const list = [{ id: 'o_1', code: 'RR1', status: 'menunggu_pembayaran', items: [{ id: 'p1', qty: 2 }], customer: { name: 'Budi' } }];
  const { order } = applyOrderPatch(list, o => o.id === 'o_1', { status: 'batal', stockReturned: true });
  assert.equal(order.status, 'batal');
  assert.equal(order.stockReturned, true);
  assert.deepEqual(order.items, [{ id: 'p1', qty: 2 }]);
  assert.deepEqual(order.customer, { name: 'Budi' });
});

test('simulasi race: patch diterapkan pada snapshot BARU (mengandung order pihak lain), bukan snapshot lama', () => {
  // Snapshot lama (dibaca di awal updateOrder, sebelum I/O stok) belum berisi
  // order baru yang masuk lewat addOrder di jendela waktu I/O stok tadi.
  const staleSnapshotBeforeStockIO = [{ id: 'o_1', code: 'RR1', status: 'menunggu_pembayaran' }];
  // Snapshot segar (dibaca ULANG tepat sebelum menulis) sudah mengandung order
  // baru itu -- inilah snapshot yang harus dipakai applyOrderPatch, bukan yang lama.
  const freshSnapshotAfterStockIO = [
    { id: 'o_1', code: 'RR1', status: 'menunggu_pembayaran' },
    { id: 'o_new', code: 'RR9', status: 'menunggu_pembayaran' },
  ];
  const { list: nextList } = applyOrderPatch(freshSnapshotAfterStockIO, o => o.id === 'o_1', { status: 'dikirim' });
  assert.equal(nextList.length, 2);
  assert.ok(nextList.some(o => o.id === 'o_new'), 'order yang masuk saat I/O stok berjalan harus tetap ada, tidak ditimpa');
  assert.equal(staleSnapshotBeforeStockIO.length, 1, 'snapshot lama tidak relevan lagi, hanya untuk perbandingan di test ini');
});
