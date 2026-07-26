import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTrackKey } from '../netlify/lib/data.js';

// Bug yang diperbaiki: recordHit()/recordGoal() menulis ke a.pages/a.sources
// (dan g.sources) tanpa batas jumlah entri BERBEDA — endpoint publik tanpa auth
// (/api/hit, /api/goal), dan path/host di dalamnya bisa dikendalikan penuh oleh
// klien (lihat normalizePath/classifySource). Siapa pun bisa mengirim path atau
// referrer palsu yang berbeda-beda tanpa henti dan membuat blob 'analytics'
// membengkak tanpa batas — beda dari rate limit per-IP yang cuma membatasi
// FREKUENSI panggilan, bukan jumlah entri berbeda yang tersimpan.
// canTrackKey() adalah gerbang murni yang dites di sini.

test('map kosong, di bawah batas -> boleh (key baru)', () => {
  assert.equal(canTrackKey({}, '/toko', 300), true);
});

test('key sudah ada -> selalu boleh walau map penuh (hitungan lama tetap jalan)', () => {
  const map = {};
  for (let i = 0; i < 5; i++) map['k' + i] = 1;
  assert.equal(canTrackKey(map, 'k0', 5), true);
});

test('key baru saat map sudah penuh -> ditolak', () => {
  const map = {};
  for (let i = 0; i < 5; i++) map['k' + i] = 1;
  assert.equal(canTrackKey(map, 'k-baru', 5), false);
});

test('key baru saat map belum penuh -> boleh', () => {
  const map = {};
  for (let i = 0; i < 4; i++) map['k' + i] = 1;
  assert.equal(canTrackKey(map, 'k-baru', 5), true);
});

test('nama seperti properti bawaan objek (mis. "hasOwnProperty") diperlakukan sebagai key baru, bukan dianggap sudah ada', () => {
  const map = {};
  for (let i = 0; i < 5; i++) map['k' + i] = 1;
  // 'hasOwnProperty' tersedia lewat prototype, bukan own-property map ini —
  // harus tetap dihitung sebagai key BARU dan ditolak begitu map penuh, bukan
  // salah dianggap sudah tercatat lewat pengecekan `map[key] !== undefined`.
  assert.equal(canTrackKey(map, 'hasOwnProperty', 5), false);
});

test('simulasi banjir path/referrer palsu: peta berhenti tumbuh setelah batas', () => {
  const pages = {};
  const MAX = 300;
  for (let i = 0; i < 1000; i++) {
    const p = '/palsu-' + i;
    if (canTrackKey(pages, p, MAX)) pages[p] = (pages[p] || 0) + 1;
  }
  assert.equal(Object.keys(pages).length, MAX, 'jumlah entri tak boleh melebihi batas walau 1000 path berbeda dikirim');
});
