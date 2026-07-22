import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidAdminPassword, MIN_ADMIN_PASSWORD_LENGTH } from '../netlify/lib/data.js';

// Bug yang diperbaiki: admin.js (changePw()) menolak password baru < 6 karakter
// di CLIENT, tapi endpoint PUT /api/admin/settings sebelumnya langsung
// hashPassword(b.newPassword) tanpa mengecek ulang panjangnya di server. Siapa
// pun yang sudah punya token admin (mis. lewat curl/devtools, bukan panel resmi)
// bisa mengganti password jadi satu karakter, melewati batas yang dikira
// berlaku dari UI. isValidAdminPassword adalah inti murni dari perbaikannya.

test('MIN_ADMIN_PASSWORD_LENGTH cocok dengan batas yang dipakai UI admin.js (6)', () => {
  assert.equal(MIN_ADMIN_PASSWORD_LENGTH, 6);
});

test('password lebih pendek dari batas -> ditolak', () => {
  assert.equal(isValidAdminPassword('12345'), false);
});

test('password kosong -> ditolak', () => {
  assert.equal(isValidAdminPassword(''), false);
});

test('password persis di batas -> diterima', () => {
  assert.equal(isValidAdminPassword('123456'), true);
});

test('password lebih panjang dari batas -> diterima', () => {
  assert.equal(isValidAdminPassword('password-yang-panjang-sekali'), true);
});

test('nilai bukan string (angka/null/undefined) -> ditolak, tidak throw', () => {
  assert.equal(isValidAdminPassword(123456), false);
  assert.equal(isValidAdminPassword(null), false);
  assert.equal(isValidAdminPassword(undefined), false);
});
