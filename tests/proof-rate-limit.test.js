import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeProofRateStatus, nextProofRateRecord } from '../netlify/lib/data.js';

// Batas: 8 unggahan bukti bayar per 60 menit per IP (lihat
// PROOF_MAX_PER_WINDOW/PROOF_WINDOW_MS di data.js).
const WINDOW_MS = 60 * 60e3;

test('computeProofRateStatus: tidak ada rekam jejak -> tidak diblokir', () => {
  const s = computeProofRateStatus(undefined, 1000);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeProofRateStatus: di bawah batas -> tidak diblokir', () => {
  const now = 1_000_000;
  const rec = { count: 7, firstAt: now - 1000 };
  const s = computeProofRateStatus(rec, now);
  assert.equal(s.blocked, false);
});

test('computeProofRateStatus: tepat di batas -> diblokir', () => {
  const now = 1_000_000;
  const rec = { count: 8, firstAt: now - 1000 };
  const s = computeProofRateStatus(rec, now);
  assert.equal(s.blocked, true);
  assert.ok(s.retryAfter > 0);
});

test('computeProofRateStatus: lewat batas -> tetap diblokir', () => {
  const now = 1_000_000;
  const rec = { count: 100, firstAt: now - 1000 };
  assert.equal(computeProofRateStatus(rec, now).blocked, true);
});

test('computeProofRateStatus: retryAfter menghitung mundur ke akhir jendela', () => {
  const now = 1_000_000;
  const rec = { count: 8, firstAt: now };
  const s = computeProofRateStatus(rec, now);
  assert.equal(s.retryAfter, Math.ceil(WINDOW_MS / 1000));
});

test('computeProofRateStatus: jendela sudah lewat -> tidak diblokir walau count tinggi', () => {
  const now = 1_000_000;
  const rec = { count: 999, firstAt: now - WINDOW_MS - 1 };
  const s = computeProofRateStatus(rec, now);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeProofRateStatus: pas di tepi jendela (sama dengan WINDOW_MS) -> masih berlaku', () => {
  const now = 1_000_000;
  const rec = { count: 8, firstAt: now - WINDOW_MS };
  assert.equal(computeProofRateStatus(rec, now).blocked, true);
});

test('nextProofRateRecord: rekam pertama dimulai dari count 1', () => {
  const now = 1_000_000;
  const r = nextProofRateRecord(undefined, now);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('nextProofRateRecord: dalam jendela -> count bertambah, firstAt tetap', () => {
  const now = 1_000_000;
  const rec = { count: 2, firstAt: now - 1000 };
  const r = nextProofRateRecord(rec, now);
  assert.equal(r.count, 3);
  assert.equal(r.firstAt, now - 1000);
});

test('nextProofRateRecord: lewat jendela -> reset ke count 1 dengan firstAt baru', () => {
  const now = 1_000_000;
  const rec = { count: 20, firstAt: now - WINDOW_MS - 1 };
  const r = nextProofRateRecord(rec, now);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('simulasi: 8 unggahan beruntun lolos, unggahan ke-9 diblokir', () => {
  let all = {};
  const ip = '5.6.7.8';
  let now = 1_000_000;
  for (let i = 1; i <= 8; i++) {
    const status = computeProofRateStatus(all[ip], now);
    assert.equal(status.blocked, false, `unggahan ke-${i} seharusnya lolos`);
    all = { ...all, [ip]: nextProofRateRecord(all[ip], now) };
    now += 10; // beberapa unggahan dibuat berdekatan
  }
  const status9 = computeProofRateStatus(all[ip], now);
  assert.equal(status9.blocked, true, 'unggahan ke-9 seharusnya diblokir');
});

test('IP berbeda tidak saling memblokir', () => {
  const now = 1_000_000;
  let all = {};
  for (let i = 1; i <= 8; i++) {
    all = { ...all, ['1.1.1.1']: nextProofRateRecord(all['1.1.1.1'], now) };
  }
  assert.equal(computeProofRateStatus(all['1.1.1.1'], now).blocked, true);
  assert.equal(computeProofRateStatus(all['9.9.9.9'], now).blocked, false);
});
