import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidNewPassword, MIN_ADMIN_PASSWORD_LENGTH } from '../netlify/lib/data.js';

// Bug yang diperbaiki: PUT /api/admin/settings dulu hanya mengecek `newPassword`
// secara truthy lalu langsung hashPassword()-nya — tanpa batas panjang minimum
// di server. Form admin (admin.js) memang sudah menolak di bawah 6 karakter,
// tapi itu cuma validasi di browser; endpoint API-nya sendiri tetap menerima
// panggilan langsung (curl/devtools, dengan token admin yang sudah didapat)
// yang mengganti password admin jadi satu karakter atau cuma spasi — melemahkan
// satu-satunya pintu masuk panel admin untuk pergantian password berikutnya.
// isValidNewPassword adalah inti murni dari perbaikannya.

test('isValidNewPassword: password sepanjang batas minimum -> valid', () => {
  assert.equal(isValidNewPassword('a'.repeat(MIN_ADMIN_PASSWORD_LENGTH)), true);
});

test('isValidNewPassword: password lebih pendek dari batas -> tidak valid', () => {
  assert.equal(isValidNewPassword('abc'), false);
});

test('isValidNewPassword: satu karakter -> tidak valid', () => {
  assert.equal(isValidNewPassword('a'), false);
});

test('isValidNewPassword: hanya spasi (trim jadi kosong) -> tidak valid', () => {
  assert.equal(isValidNewPassword('      '), false);
});

test('isValidNewPassword: string kosong -> tidak valid', () => {
  assert.equal(isValidNewPassword(''), false);
});

test('isValidNewPassword: bukan string (angka/objek/null/undefined) -> tidak valid, tidak throw', () => {
  assert.equal(isValidNewPassword(123456), false);
  assert.equal(isValidNewPassword(null), false);
  assert.equal(isValidNewPassword(undefined), false);
  assert.equal(isValidNewPassword({ pw: 'rahasia123' }), false);
});

test('isValidNewPassword: password wajar lebih panjang dari batas -> valid', () => {
  assert.equal(isValidNewPassword('rahasia123'), true);
});
