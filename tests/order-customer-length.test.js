import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeCustomer } from '../netlify/lib/data.js';

// Bug yang diperbaiki: POST /api/orders (publik, tanpa auth) dulu menyimpan
// customer.name/phone/address/city/note langsung tanpa batas panjang, padahal
// semua endpoint publik lain (hit.js, goal.js, cleanPriceItem) membatasi input
// teks bebas. Order disimpan sebagai satu blob `orders` yang dibaca-tulis-ulang
// UTUH di tiap order baru & upload bukti bayar — address/note tanpa batas bisa
// membengkakkan blob itu tak terbatas dan memperlambat/mematahkan alur booking.

test('sanitizeCustomer memotong tiap field ke batas panjangnya', () => {
  const huge = 'x'.repeat(10_000);
  const c = sanitizeCustomer({ name: huge, phone: huge, address: huge, city: huge, note: huge });
  assert.equal(c.name.length, 80);
  assert.equal(c.phone.length, 20);
  assert.equal(c.address.length, 300);
  assert.equal(c.city.length, 60);
  assert.equal(c.note.length, 300);
});

test('sanitizeCustomer tidak mengubah nilai yang sudah di bawah batas', () => {
  const c = sanitizeCustomer({ name: 'Budi', phone: '08123456789', address: 'Jl. Mawar No. 1', city: 'Jakarta', note: 'Titip di satpam' });
  assert.deepEqual(c, {
    name: 'Budi', phone: '08123456789', address: 'Jl. Mawar No. 1', city: 'Jakarta', note: 'Titip di satpam',
  });
});

test('sanitizeCustomer: city & note opsional -> default string kosong, bukan crash', () => {
  const c = sanitizeCustomer({ name: 'Budi', phone: '08123456789', address: 'Jl. Mawar' });
  assert.equal(c.city, '');
  assert.equal(c.note, '');
});

test('sanitizeCustomer: field angka (mis. phone dikirim sebagai number) tidak crash', () => {
  const c = sanitizeCustomer({ name: 'Budi', phone: 81234567890, address: 'Jl. Mawar' });
  assert.equal(c.phone, '81234567890');
});
