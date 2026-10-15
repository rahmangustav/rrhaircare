import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import '../public/js/booking-time.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BOOKING_TIME_FILE = path.join(__dirname, '../public/js/booking-time.js');

const { todayWIB, slotStartMinutes, isSlotPast, formatTanggalBooking } = globalThis.BookingTime;

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

test('formatTanggalBooking: format Indonesia lengkap dari nilai <input type=date>', () => {
  assert.equal(formatTanggalBooking('2026-08-05'), 'Rabu, 5 Agustus 2026');
});

test('formatTanggalBooking: input kosong/tak dikenali -> dikembalikan apa adanya, tidak error', () => {
  assert.equal(formatTanggalBooking(''), '');
  assert.equal(formatTanggalBooking(undefined), '');
  assert.equal(formatTanggalBooking('bukan-tanggal'), 'bukan-tanggal');
});

test('formatTanggalBooking: tanggal yang tampil di pesan booking TIDAK boleh mundur satu hari ' +
  'untuk pengunjung di zona waktu sebelah barat UTC (mis. diaspora yang booking dari luar negeri) — ' +
  'sebelumnya `new Date(tanggalString)` diparse sebagai UTC tengah malam lalu diformat di zona LOKAL ' +
  'perangkat, jadi tanggal booking yang terkirim ke WhatsApp salah satu hari lebih awal', () => {
  const script = `
    globalThis.window = globalThis;
    require(${JSON.stringify(BOOKING_TIME_FILE)});
    console.log(globalThis.BookingTime.formatTanggalBooking('2026-08-05'));
  `;
  for (const tz of ['America/New_York', 'Pacific/Midway', 'Asia/Jakarta']) {
    const out = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz } })
      .toString().trim();
    assert.equal(out, 'Rabu, 5 Agustus 2026', `zona ${tz} menghasilkan tanggal yang salah: ${out}`);
  }
});
