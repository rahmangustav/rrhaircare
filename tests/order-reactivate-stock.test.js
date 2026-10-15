import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyStockReservation } from '../netlify/lib/data.js';

// Bug yang diperbaiki: admin-orders.js (PUT /api/admin/orders/:id) mengizinkan
// admin mengubah status order 'batal' -> aktif lagi (mis. 'diproses') lewat
// dropdown status. Sebelumnya deductStockFor() memotong stok balik dengan
// `Math.max(0, stok - qty)` TANPA mengecek kecukupan stok saat ini — kalau unit
// fisik yang sama sudah "diambil" order lain sejak order pertama di-auto-cancel
// (lewat expireStaleOrders) dan stoknya dikembalikan, reaktivasi tetap "berhasil"
// diam-diam (stok cuma diklem ke 0), sehingga DUA order sama-sama dianggap sah
// untuk 1 unit fisik yang sama -> oversell nyata, bukan cuma angka stok salah.
//
// deductStockFor() sekarang memakai pengecekan yang sama dengan order baru
// (applyStockReservation) sebelum memotong — skenario di bawah mensimulasikan
// urutan kejadian nyata itu dan membuktikan reaktivasi kedua yang harus GAGAL.

test('order batal diaktifkan lagi setelah unit yang sama diambil order lain -> ditolak (bukan diam-diam disahkan)', () => {
  const store = [{ id: 'p1', stock: 1 }];
  const readFresh = () => store.map(p => ({ ...p }));
  const orderItems = [{ id: 'p1', qty: 1 }];

  // 1) Order A memesan unit terakhir -> stok jadi 0.
  const snapA = readFresh();
  const shortA = applyStockReservation(snapA, orderItems);
  assert.deepEqual(shortA, [], 'order A harus lolos, unit masih tersedia');
  store[0].stock = snapA[0].stock;
  assert.equal(store[0].stock, 0);

  // 2) Order A telat bayar -> auto-cancel, stok dikembalikan (restoreStockFor: stok += qty).
  store[0].stock += orderItems[0].qty;
  assert.equal(store[0].stock, 1);

  // 3) Order B memesan unit yang baru saja kembali itu -> lolos, stok jadi 0 lagi.
  const snapB = readFresh();
  const shortB = applyStockReservation(snapB, orderItems);
  assert.deepEqual(shortB, [], 'order B harus lolos, unit sudah dikembalikan');
  store[0].stock = snapB[0].stock;
  assert.equal(store[0].stock, 0);

  // 4) Admin mengaktifkan-ulang order A yang sudah 'batal' -> deductStockFor()
  // dipanggil dengan item order A yang sama, terhadap stok TERKINI (0, sudah
  // diambil order B). Ini yang sekarang harus ditolak, bukan diam-diam disahkan.
  const snapReactivate = readFresh();
  const shortReactivate = applyStockReservation(snapReactivate, orderItems);
  assert.deepEqual(shortReactivate, ['p1'], 'reaktivasi harus gagal, unit fisiknya sudah dipakai order B');
  assert.equal(store[0].stock, 0, 'stok tidak boleh berubah/minus akibat reaktivasi yang gagal');
});

test('order batal diaktifkan lagi dan stoknya masih cukup -> tetap boleh (tidak ada regresi)', () => {
  const store = [{ id: 'p1', stock: 5 }];
  const items = [{ id: 'p1', qty: 2 }];

  // Order dibuat (stok 5->3), lalu dibatalkan & dikembalikan (3->5), lalu
  // diaktifkan lagi tanpa ada order lain yang mengambil stoknya di antaranya.
  const snap = store.map(p => ({ ...p }));
  const short = applyStockReservation(snap, items);
  assert.deepEqual(short, [], 'stok masih cukup -> reaktivasi harus tetap boleh');
  assert.equal(snap[0].stock, 3);
});
