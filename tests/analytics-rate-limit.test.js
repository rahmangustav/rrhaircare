import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAnalyticsRateStatus, nextAnalyticsRateRecord } from '../netlify/lib/data.js';

// Batas: 120 panggilan per 10 menit per IP (lihat ANALYTICS_MAX_PER_WINDOW/
// ANALYTICS_WINDOW_MS di data.js) — dipakai bersama oleh /api/hit & /api/goal.
const WINDOW_MS = 10 * 60e3;
const MAX = 120;

test('computeAnalyticsRateStatus: tidak ada rekam jejak -> tidak diblokir', () => {
  const s = computeAnalyticsRateStatus(undefined, 1000);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeAnalyticsRateStatus: di bawah batas -> tidak diblokir', () => {
  const now = 1_000_000;
  const rec = { count: MAX - 1, firstAt: now - 1000 };
  const s = computeAnalyticsRateStatus(rec, now);
  assert.equal(s.blocked, false);
});

test('computeAnalyticsRateStatus: tepat di batas -> diblokir', () => {
  const now = 1_000_000;
  const rec = { count: MAX, firstAt: now - 1000 };
  const s = computeAnalyticsRateStatus(rec, now);
  assert.equal(s.blocked, true);
  assert.ok(s.retryAfter > 0);
});

test('computeAnalyticsRateStatus: lewat batas -> tetap diblokir', () => {
  const now = 1_000_000;
  const rec = { count: MAX * 10, firstAt: now - 1000 };
  assert.equal(computeAnalyticsRateStatus(rec, now).blocked, true);
});

test('computeAnalyticsRateStatus: jendela sudah lewat -> tidak diblokir walau count tinggi', () => {
  const now = 1_000_000;
  const rec = { count: 9999, firstAt: now - WINDOW_MS - 1 };
  const s = computeAnalyticsRateStatus(rec, now);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeAnalyticsRateStatus: pas di tepi jendela (sama dengan WINDOW_MS) -> masih berlaku', () => {
  const now = 1_000_000;
  const rec = { count: MAX, firstAt: now - WINDOW_MS };
  assert.equal(computeAnalyticsRateStatus(rec, now).blocked, true);
});

test('nextAnalyticsRateRecord: rekam pertama dimulai dari count 1', () => {
  const now = 1_000_000;
  const r = nextAnalyticsRateRecord(undefined, now);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('nextAnalyticsRateRecord: dalam jendela -> count bertambah, firstAt tetap', () => {
  const now = 1_000_000;
  const rec = { count: 2, firstAt: now - 1000 };
  const r = nextAnalyticsRateRecord(rec, now);
  assert.equal(r.count, 3);
  assert.equal(r.firstAt, now - 1000);
});

test('nextAnalyticsRateRecord: lewat jendela -> reset ke count 1 dengan firstAt baru', () => {
  const now = 1_000_000;
  const rec = { count: 500, firstAt: now - WINDOW_MS - 1 };
  const r = nextAnalyticsRateRecord(rec, now);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('simulasi: pengunjung wajar (belasan panggilan) tidak pernah diblokir', () => {
  let all = {};
  const ip = '1.2.3.4';
  let now = 1_000_000;
  for (let i = 1; i <= 20; i++) {
    const status = computeAnalyticsRateStatus(all[ip], now);
    assert.equal(status.blocked, false, `panggilan ke-${i} seharusnya lolos`);
    all = { ...all, [ip]: nextAnalyticsRateRecord(all[ip], now) };
    now += 5000; // beberapa halaman dibuka berturut-turut
  }
});

test('simulasi: 120 panggilan beruntun lolos, panggilan ke-121 diblokir', () => {
  let all = {};
  const ip = '1.2.3.4';
  let now = 1_000_000;
  for (let i = 1; i <= MAX; i++) {
    const status = computeAnalyticsRateStatus(all[ip], now);
    assert.equal(status.blocked, false, `panggilan ke-${i} seharusnya lolos`);
    all = { ...all, [ip]: nextAnalyticsRateRecord(all[ip], now) };
    now += 10;
  }
  const statusNext = computeAnalyticsRateStatus(all[ip], now);
  assert.equal(statusNext.blocked, true, 'panggilan ke-121 seharusnya diblokir');
});
