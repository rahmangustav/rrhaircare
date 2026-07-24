import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../public/js/booking-time.js';

const { todayWIB, slotStartMinutes, isSlotPast, formatBookingDate } = globalThis.BookingTime;
const bookingTimePath = fileURLToPath(new URL('../public/js/booking-time.js', import.meta.url));

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

test('formatBookingDate: format tanggal Indonesia lengkap', () => {
  assert.equal(formatBookingDate('2026-07-25'), 'Sabtu, 25 Juli 2026');
});

test('formatBookingDate: format tak dikenali -> dikembalikan apa adanya (gagal aman)', () => {
  assert.equal(formatBookingDate(''), '');
  assert.equal(formatBookingDate('bukan-tanggal'), 'bukan-tanggal');
  assert.equal(formatBookingDate(undefined), '');
});

test('formatBookingDate: hasil TIDAK mundur satu hari untuk timezone di belakang UTC (regresi)', () => {
  // Reproduksi bug lama: `new Date('2026-07-25')` diparse sebagai tengah malam
  // UTC, lalu toLocaleDateString() format pakai timezone LOKAL proses. Di
  // timezone yang di belakang UTC (mis. America/New_York, UTC-4/-5), itu
  // menghasilkan 'Jumat, 24 Juli 2026' -- mundur satu hari dari yang dipilih
  // pengunjung di date picker. formatBookingDate() harus tetap benar karena
  // membangun & memformat Date dari komponen LOKAL saja, tanpa lewat UTC.
  const out = execFileSync(process.execPath, ['-e', `
    import('${bookingTimePath.replace(/\\/g, '/')}').then(() => {
      console.log(globalThis.BookingTime.formatBookingDate('2026-07-25'));
    });
  `, '--input-type=module'], { env: { ...process.env, TZ: 'America/New_York' }, encoding: 'utf8' }).trim();
  assert.equal(out, 'Sabtu, 25 Juli 2026');
});
