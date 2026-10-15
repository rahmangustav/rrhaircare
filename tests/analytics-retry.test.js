import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeAnalyticsWithRetry } from '../netlify/lib/data.js';

// Bug yang diperbaiki: recordHit()/recordGoal() dulu baca blob 'analytics' SEKALI,
// ubah in-memory, lalu tulis balik seluruh snapshot itu -- read-modify-write tanpa
// penguncian. Netlify Blobs (SDK ini) tidak punya conditional write, jadi dua
// request /api/hit atau /api/goal yang nyaris bersamaan bisa saling menimpa: yang
// menulis belakangan menang, increment yang lain hilang diam-diam. writeAnalyticsWithRetry
// membaca ulang etag TEPAT sebelum menulis dan mengulang mutasi dari data terbaru
// kalau ada penulis lain yang lebih dulu -- dites di sini dengan store PALSU (tanpa
// jaringan/Blobs sungguhan), mengikuti pola pengujian applyOrderPatch/normalizePath
// di file lain (fungsi murni/injectable, bukan mock framework).

function makeFakeStore(initialData) {
  let data = initialData;
  let etag = 'v0';
  let writeCount = 0;
  let getCount = 0;
  return {
    async getWithMetadata() {
      getCount++;
      if (data === null) return null;
      return { data: structuredClone(data), etag };
    },
    async setJSON(_key, value) {
      writeCount++;
      data = value;
      etag = 'v' + writeCount;
    },
    // Simulasikan invocation lain yang menulis di antara pembacaan awal dan
    // pembacaan-ulang TEPAT sebelum menulis (jendela race).
    simulateConcurrentWrite(patch) {
      data = { ...data, ...patch };
      etag = 'external-' + Math.random();
    },
    snapshot: () => data,
    get getCount() { return getCount; },
    get writeCount() { return writeCount; },
  };
}

test('tanpa kontensi: satu pembacaan-ulang cukup, mutasi ditulis langsung', async () => {
  const store = makeFakeStore({ total: { views: 5 } });
  const result = await writeAnalyticsWithRetry(store, (a) => { a.total.views++; return a; });
  assert.equal(result.total.views, 6);
  assert.equal(store.snapshot().total.views, 6);
  assert.equal(store.writeCount, 1);
});

test('blob belum ada (null) -> mutasi jalan dari objek kosong, bukan crash', async () => {
  const store = makeFakeStore(null);
  const result = await writeAnalyticsWithRetry(store, (a) => {
    a.total = a.total || { views: 0 };
    a.total.views++;
    return a;
  });
  assert.equal(result.total.views, 1);
});

test('ada penulis lain di jendela sebelum tulis -> mutasi diulang dari data TERBARU, tidak menimpa buta', async () => {
  const store = makeFakeStore({ total: { views: 10 } });
  let calls = 0;
  const result = await writeAnalyticsWithRetry(store, (a) => {
    calls++;
    if (calls === 1) {
      // Setelah pembacaan awal ini "dipakai" untuk menghitung, tapi SEBELUM
      // writeAnalyticsWithRetry sempat menulis, invocation lain menulis duluan.
      store.simulateConcurrentWrite({ total: { views: 999 } });
    }
    a.total.views++;
    return a;
  });
  // Mutasi harus diterapkan ULANG pada data terbaru (views:999), bukan pada
  // data basi hasil pembacaan pertama (views:10) yang akan menghasilkan 11 dan
  // menghilangkan increment invocation lain.
  assert.equal(calls, 2, 'mutasi harus dipanggil ulang sekali karena konflik etag terdeteksi');
  assert.equal(result.total.views, 1000);
  assert.equal(store.snapshot().total.views, 1000);
});

test('kontensi terus-menerus (lebih dari maxAttempts) -> tetap menulis di percobaan terakhir, tidak diam kehilangan event selamanya', async () => {
  const store = makeFakeStore({ total: { views: 0 } });
  let calls = 0;
  const result = await writeAnalyticsWithRetry(store, (a) => {
    calls++;
    // Setiap kali dipanggil (kecuali percobaan terakhir), penulis lain menyusul
    // lagi -- mensimulasikan kontensi tinggi yang tak pernah "diam" tepat waktu.
    if (calls < 4) store.simulateConcurrentWrite({});
    a.total.views++;
    return a;
  }, { maxAttempts: 4 });
  assert.equal(calls, 4, 'harus berhenti mencoba ulang setelah maxAttempts, bukan retry tanpa batas');
  assert.equal(result.total.views, 1);
  assert.ok(store.writeCount >= 1, 'tetap harus menulis sesuatu, bukan diam tak menyimpan event sama sekali');
});

test('tidak ada race -> jumlah pembacaan minimal (2x: awal + recheck), tidak retry berlebihan', async () => {
  const store = makeFakeStore({ total: { views: 0 } });
  await writeAnalyticsWithRetry(store, (a) => { a.total.views++; return a; });
  assert.equal(store.getCount, 2, 'pembacaan awal + satu kali recheck sebelum menulis, tanpa race seharusnya tidak lebih dari itu');
});
