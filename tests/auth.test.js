import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword, verifyPassword, signToken, verifyToken,
  computeLoginRateStatus, nextLoginRateRecord,
  parseTokenExp, nextRevokedRecord, isTokenRevoked,
} from '../netlify/lib/data.js';

// ── hashPassword / verifyPassword ──
// Menjaga endpoint /api/admin/login — satu-satunya pintu ke panel admin
// (harga, stok, pesanan). Sebelum PR ini, nol test menyentuh fungsi ini.

test('hashPassword: menghasilkan salt berbeda tiap kali dipanggil', () => {
  const a = hashPassword('rahasia123');
  const b = hashPassword('rahasia123');
  assert.notEqual(a, b, 'dua hash dari password sama harus punya salt acak berbeda');
});

test('verifyPassword: password benar -> true', () => {
  const stored = hashPassword('rahasia123');
  assert.equal(verifyPassword('rahasia123', stored), true);
});

test('verifyPassword: password salah -> false', () => {
  const stored = hashPassword('rahasia123');
  assert.equal(verifyPassword('salah-password', stored), false);
});

test('verifyPassword: stored kosong -> false, tidak throw', () => {
  assert.equal(verifyPassword('apa saja', ''), false);
  assert.equal(verifyPassword('apa saja', null), false);
  assert.equal(verifyPassword('apa saja', undefined), false);
});

test('verifyPassword: stored rusak (tanpa pemisah ":") -> false, tidak throw', () => {
  assert.equal(verifyPassword('apa saja', 'bukanhashvalid'), false);
});

test('verifyPassword: hash beda panjang tidak menyebabkan timingSafeEqual throw', () => {
  // hash target sengaja dipendekkan -> panjang buffer beda dari hasil scrypt (64 byte -> 128 hex).
  const stored = 'garam:abcd';
  assert.equal(verifyPassword('apa saja', stored), false);
});

// ── signToken / verifyToken ──

test('signToken + verifyToken: token yang baru dibuat valid', () => {
  const secret = 'secret-test';
  const token = signToken(secret, 12);
  assert.equal(verifyToken(token, secret), true);
});

test('verifyToken: secret salah -> false', () => {
  const token = signToken('secret-benar', 12);
  assert.equal(verifyToken(token, 'secret-salah'), false);
});

test('verifyToken: token kedaluwarsa -> false', () => {
  const secret = 'secret-test';
  const token = signToken(secret, -1); // exp di masa lalu
  assert.equal(verifyToken(token, secret), false);
});

test('verifyToken: payload diutak-atik (signature tak lagi cocok) -> false', () => {
  const secret = 'secret-test';
  const token = signToken(secret, 12);
  const [, sig] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ exp: Date.now() + 999 * 3600e3 })).toString('base64url');
  assert.equal(verifyToken(forgedPayload + '.' + sig, secret), false);
});

test('verifyToken: token kosong/tanpa titik/rusak -> false, tidak throw', () => {
  assert.equal(verifyToken('', 'secret'), false);
  assert.equal(verifyToken(null, 'secret'), false);
  assert.equal(verifyToken('tanpa-titik', 'secret'), false);
  assert.equal(verifyToken('payload-rusak.sig-rusak', 'secret'), false);
});

// ── computeLoginRateStatus / nextLoginRateRecord ──
// Anti brute-force login admin: 5 gagal berturut dalam 15 menit -> kunci 15 menit.

test('computeLoginRateStatus: tidak ada rekam jejak -> tidak diblokir', () => {
  const s = computeLoginRateStatus(undefined, 1000);
  assert.equal(s.blocked, false);
  assert.equal(s.retryAfter, 0);
});

test('computeLoginRateStatus: gagal di bawah batas (belum terkunci) -> tidak diblokir', () => {
  const rec = { count: 3, firstAt: 1000 };
  assert.equal(computeLoginRateStatus(rec, 2000).blocked, false);
});

test('computeLoginRateStatus: sedang terkunci -> diblokir dengan retryAfter > 0', () => {
  const now = 1_000_000;
  const rec = { count: 5, firstAt: now - 1000, lockedUntil: now + 60_000 };
  const s = computeLoginRateStatus(rec, now);
  assert.equal(s.blocked, true);
  assert.equal(s.retryAfter, 60);
});

test('computeLoginRateStatus: kunci sudah lewat -> tidak diblokir lagi', () => {
  const now = 1_000_000;
  const rec = { count: 5, firstAt: now - 999_999, lockedUntil: now - 1 };
  assert.equal(computeLoginRateStatus(rec, now).blocked, false);
});

test('nextLoginRateRecord: login sukses -> null (rekam jejak dihapus)', () => {
  const rec = { count: 4, firstAt: 1000 };
  assert.equal(nextLoginRateRecord(rec, 2000, true), null);
});

test('nextLoginRateRecord: gagal pertama -> count 1, belum terkunci', () => {
  const now = 1_000_000;
  const r = nextLoginRateRecord(undefined, now, false);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('nextLoginRateRecord: gagal berturut dalam jendela -> count bertambah, firstAt tetap', () => {
  const rec = { count: 2, firstAt: 1000 };
  const r = nextLoginRateRecord(rec, 1500, false);
  assert.equal(r.count, 3);
  assert.equal(r.firstAt, 1000);
  assert.equal(r.lockedUntil, undefined);
});

test('nextLoginRateRecord: gagal ke-5 -> lockedUntil terpasang LOGIN_LOCK_MS ke depan', () => {
  const now = 1_000_000;
  const rec = { count: 4, firstAt: now - 1000 };
  const r = nextLoginRateRecord(rec, now, false);
  assert.equal(r.count, 5);
  assert.equal(r.lockedUntil, now + 15 * 60e3);
});

test('nextLoginRateRecord: gagal setelah jendela lama lewat -> reset ke count 1', () => {
  const now = 1_000_000;
  const rec = { count: 5, firstAt: now - 16 * 60e3, lockedUntil: now - 60_000 };
  const r = nextLoginRateRecord(rec, now, false);
  assert.deepEqual(r, { count: 1, firstAt: now });
});

test('simulasi: 5 login gagal berturut -> percobaan ke-6 diblokir', () => {
  let rec;
  let now = 1_000_000;
  for (let i = 1; i <= 5; i++) {
    const status = computeLoginRateStatus(rec, now);
    assert.equal(status.blocked, false, `percobaan ke-${i} seharusnya belum diblokir`);
    rec = nextLoginRateRecord(rec, now, false);
    now += 10;
  }
  assert.equal(computeLoginRateStatus(rec, now).blocked, true, 'percobaan ke-6 seharusnya diblokir');
});

test('simulasi: login sukses di tengah jalan membersihkan hitungan gagal sebelumnya', () => {
  let rec;
  let now = 1_000_000;
  rec = nextLoginRateRecord(rec, now, false);
  rec = nextLoginRateRecord(rec, now + 10, false);
  assert.equal(rec.count, 2);
  rec = nextLoginRateRecord(rec, now + 20, true);
  assert.equal(rec, null);
  assert.equal(computeLoginRateStatus(rec, now + 20).blocked, false);
});

// ── parseTokenExp / nextRevokedRecord / isTokenRevoked ──
// Token admin stateless tetap sah sampai `exp` (12 jam) walau tombol "Keluar"
// diklik — sebelum ini, logout murni kosmetik di klien (lihat catatan di
// data.js). Fungsi-fungsi ini mencabut token spesifik (by signature) di server.

test('parseTokenExp: token valid -> mengembalikan angka exp', () => {
  const token = signToken('secret-test', 12);
  const exp = parseTokenExp(token);
  assert.equal(typeof exp, 'number');
  assert.ok(exp > Date.now());
});

test('parseTokenExp: token kosong/tanpa titik/payload rusak -> null, tidak throw', () => {
  assert.equal(parseTokenExp(''), null);
  assert.equal(parseTokenExp(null), null);
  assert.equal(parseTokenExp('tanpa-titik'), null);
  assert.equal(parseTokenExp('payload-rusak.sig'), null);
});

test('nextRevokedRecord: token baru dicabut -> masuk daftar dengan exp-nya', () => {
  const now = 1_000_000;
  const next = nextRevokedRecord({}, 'sig-abc', now + 60_000, now);
  assert.equal(next['sig-abc'], now + 60_000);
});

test('nextRevokedRecord: entri lama yang exp aslinya sudah lewat -> dibuang (blob tak membengkak)', () => {
  const now = 1_000_000;
  const all = { 'sig-lama': now - 1 }; // exp sudah lewat
  const next = nextRevokedRecord(all, null, null, now);
  assert.deepEqual(next, {});
});

test('nextRevokedRecord: token tanpa exp valid (undefined/sudah kedaluwarsa) -> tidak ditambahkan', () => {
  const now = 1_000_000;
  assert.deepEqual(nextRevokedRecord({}, 'sig-x', null, now), {});
  assert.deepEqual(nextRevokedRecord({}, 'sig-x', now - 1, now), {});
});

test('isTokenRevoked: signature ada di daftar & belum lewat exp-nya -> true', () => {
  const now = 1_000_000;
  const all = { 'sig-abc': now + 60_000 };
  assert.equal(isTokenRevoked(all, 'sig-abc', now), true);
});

test('isTokenRevoked: signature tidak ada di daftar -> false', () => {
  assert.equal(isTokenRevoked({}, 'sig-lain', 1_000_000), false);
});

test('isTokenRevoked: signature ada tapi exp pencatatan sudah lewat -> false', () => {
  const now = 1_000_000;
  const all = { 'sig-abc': now - 1 };
  assert.equal(isTokenRevoked(all, 'sig-abc', now), false);
});

test('simulasi: token dicabut saat logout -> requireAuth (via isTokenRevoked) menolak walau signature masih valid', () => {
  const secret = 'secret-test';
  const token = signToken(secret, 12);
  assert.equal(verifyToken(token, secret), true, 'sebelum dicabut, token masih valid secara signature+exp');
  const [, sig] = token.split('.');
  const now = Date.now();
  const revoked = nextRevokedRecord({}, sig, parseTokenExp(token), now);
  // verifyToken tetap true (signature+exp tak berubah) — isTokenRevoked yang harus menolak.
  assert.equal(verifyToken(token, secret), true);
  assert.equal(isTokenRevoked(revoked, sig, now), true, 'token yang sudah dicabut harus ditolak requireAuth');
});
