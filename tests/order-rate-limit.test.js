import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeOrderRateStatus, nextOrderRateRecord } from '../netlify/lib/data.js';

// Batas: 5 order per 30 menit per IP (lihat ORDER_MAX_PER_WINDOW/ORDER_WINDOW_MS di data.js).
const WINDOW_MS = 30 * 60e3;

test('computeOrderRateStatus: tidak ada rekam jejak -> tidak diblokir', () => {
  const s = computeOrderRateStatus(undefined, 1000);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeOrderRateStatus: di bawah batas -> tidak diblokir', () => {
  const now = 1_000_000;
  const rec = { count: 4, firstAt: now - 1000 };
  const s = computeOrderRateStatus(rec, now);
  assert.equal(s.blocked, false);
});

test('computeOrderRateStatus: tepat di batas -> diblokir', () => {
  const now = 1_000_000;
  const rec = { count: 5, firstAt: now - 1000 };
  const s = computeOrderRateStatus(rec, now);
  assert.equal(s.blocked, true);
  assert.ok(s.retryAfter > 0);
});

test('computeOrderRateStatus: lewat batas -> tetap diblokir', () => {
  const now = 1_000_000;
  const rec = { count: 50, firstAt: now - 1000 };
  assert.equal(computeOrderRateStatus(rec, now).blocked, true);
});

test('computeOrderRateStatus: retryAfter menghitung mundur ke akhir jendela', () => {
  const now = 1_000_000;
  const rec = { count: 5, firstAt: now };
  const s = computeOrderRateStatus(rec, now);
  assert.equal(s.retryAfter, Math.ceil(WINDOW_MS / 1000));
});

test('computeOrderRateStatus: jendela sudah lewat -> tidak diblokir walau count tinggi', () => {
  const now = 1_000_000;
  const rec = { count: 999, firstAt: now - WINDOW_MS - 1 };
  const s = computeOrderRateStatus(rec, now);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeOrderRateStatus: pas di tepi jendela (sama dengan WINDOW_MS) -> masih berlaku', () => {
  const now = 1_000_000;
  const rec = { count: 5, firstAt: now - WINDOW_MS };
  assert.equal(computeOrderRateStatus(rec, now).blocked, true);
});

test('nextOrderRateRecord: rekam pertama dimulai dari count 1', () => {
  const now = 1_000_000;
  const r = nextOrderRateRecord(undefined, now);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('nextOrderRateRecord: dalam jendela -> count bertambah, firstAt tetap', () => {
  const now = 1_000_000;
  const rec = { count: 2, firstAt: now - 1000 };
  const r = nextOrderRateRecord(rec, now);
  assert.equal(r.count, 3);
  assert.equal(r.firstAt, now - 1000);
});

test('nextOrderRateRecord: lewat jendela -> reset ke count 1 dengan firstAt baru', () => {
  const now = 1_000_000;
  const rec = { count: 20, firstAt: now - WINDOW_MS - 1 };
  const r = nextOrderRateRecord(rec, now);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('simulasi: 5 order beruntun lolos, order ke-6 diblokir', () => {
  let all = {};
  const ip = '1.2.3.4';
  let now = 1_000_000;
  for (let i = 1; i <= 5; i++) {
    const status = computeOrderRateStatus(all[ip], now);
    assert.equal(status.blocked, false, `order ke-${i} seharusnya lolos`);
    all = { ...all, [ip]: nextOrderRateRecord(all[ip], now) };
    now += 10; // beberapa order dibuat berdekatan
  }
  const status6 = computeOrderRateStatus(all[ip], now);
  assert.equal(status6.blocked, true, 'order ke-6 seharusnya diblokir');
});
