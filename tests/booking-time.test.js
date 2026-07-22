import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/booking-time.js';

const { todayWIB, slotStartMinutes, isSlotPast } = globalThis.BookingTime;

test('todayWIB: tengah malam WIB (00:30) masih tanggal yang sama, bukan mundur ke UTC kemarin', () => {
  // 2026-07-22 00:30 WIB = 2026-07-21 17:30 UTC
  const nowMs = Date.parse('2026-07-21T17:30:00.000Z');
  assert.equal(todayWIB(nowMs), '2026-07-22');
});

test('todayWIB: sore WIB, UTC & WIB kebetulan tanggal sama', () => {
  // 2026-07-22 14:00 WIB = 2026-07-22 07:00 UTC
  const nowMs = Date.parse('2026-07-22T07:00:00.000Z');
  assert.equal(todayWIB(nowMs), '2026-07-22');
});

test('slotStartMinutes: parse jam mulai dari label rentang', () => {
  assert.equal(slotStartMinutes('09:00 - 10:00'), 540);
  assert.equal(slotStartMinutes('20:00 - 21:00'), 1200);
});

test('slotStartMinutes: format tak dikenali -> null', () => {
  assert.equal(slotStartMinutes(''), null);
  assert.equal(slotStartMinutes(undefined), null);
  assert.equal(slotStartMinutes('malam'), null);
});

test('isSlotPast: tanggal bukan hari ini -> tidak pernah lewat', () => {
  const nowMs = Date.parse('2026-07-22T10:00:00.000Z'); // 17:00 WIB
  assert.equal(isSlotPast('2026-07-23', '09:00 - 10:00', nowMs), false);
});

test('isSlotPast: hari ini, jam sudah lewat -> true', () => {
  // 17:00 WIB hari ini, slot 09:00-10:00 sudah lama lewat
  const nowMs = Date.parse('2026-07-22T10:00:00.000Z');
  assert.equal(isSlotPast('2026-07-22', '09:00 - 10:00', nowMs), true);
});

test('isSlotPast: hari ini, jam masih akan datang -> false', () => {
  // 08:00 WIB hari ini, slot 09:00-10:00 belum mulai
  const nowMs = Date.parse('2026-07-22T01:00:00.000Z');
  assert.equal(isSlotPast('2026-07-22', '09:00 - 10:00', nowMs), false);
});

test('isSlotPast: pas di menit mulai slot -> dianggap sudah lewat (tidak bisa booking mendadak)', () => {
  // tepat 09:00 WIB
  const nowMs = Date.parse('2026-07-22T02:00:00.000Z');
  assert.equal(isSlotPast('2026-07-22', '09:00 - 10:00', nowMs), true);
});

test('isSlotPast: dini hari WIB (00:30), tanggal hari ini dari picker sudah benar (WIB) -> slot pagi belum lewat', () => {
  // 2026-07-22 00:30 WIB, tanggal WIB hari ini = '2026-07-22'
  const nowMs = Date.parse('2026-07-21T17:30:00.000Z');
  assert.equal(todayWIB(nowMs), '2026-07-22');
  assert.equal(isSlotPast('2026-07-22', '09:00 - 10:00', nowMs), false);
});

test('isSlotPast: format jam tak dikenali -> tidak pernah dianggap lewat (gagal aman, bukan blokir salah)', () => {
  const nowMs = Date.parse('2026-07-22T12:00:00.000Z');
  assert.equal(isSlotPast('2026-07-22', 'jam-aneh', nowMs), false);
});

test('isSlotPast: tanggal kosong -> false', () => {
  const nowMs = Date.parse('2026-07-22T12:00:00.000Z');
  assert.equal(isSlotPast('', '09:00 - 10:00', nowMs), false);
});
