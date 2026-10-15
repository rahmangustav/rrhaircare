import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bufferMatchesImageType } from '../netlify/lib/data.js';

// Bug yang diperbaiki: saveMedia() (order-proof.js, endpoint publik TANPA
// login) hanya mempercayai tipe MIME yang diklaim di header data URL
// ("data:image/jpeg;base64,..."), tanpa memeriksa byte sungguhan file —
// siapa pun bisa unggah file apa saja mengaku "image/jpeg" dan tersimpan
// lalu disajikan balik lewat /api/media/:key dengan content-type itu.
// bufferMatchesImageType() adalah inti murni perbaikannya: verifikasi
// tanda tangan byte awal file cocok dengan tipe yang diklaim.

test('JPEG asli (FF D8 FF...) -> cocok image/jpeg', () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(bufferMatchesImageType(buf, 'image/jpeg'), true);
});

test('PNG asli -> cocok image/png', () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.equal(bufferMatchesImageType(buf, 'image/png'), true);
});

test('GIF87a dan GIF89a -> cocok image/gif', () => {
  assert.equal(bufferMatchesImageType(Buffer.from('GIF87a' + 'xx'), 'image/gif'), true);
  assert.equal(bufferMatchesImageType(Buffer.from('GIF89a' + 'xx'), 'image/gif'), true);
});

test('WEBP asli (RIFF....WEBP) -> cocok image/webp', () => {
  const buf = Buffer.concat([
    Buffer.from('RIFF'), Buffer.from([0x00, 0x00, 0x00, 0x00]), Buffer.from('WEBP'),
  ]);
  assert.equal(bufferMatchesImageType(buf, 'image/webp'), true);
});

test('file teks/HTML mengaku image/jpeg -> ditolak (spoofing)', () => {
  const buf = Buffer.from('<html><script>alert(1)</script></html>');
  assert.equal(bufferMatchesImageType(buf, 'image/jpeg'), false);
});

test('PNG asli tapi diklaim image/gif -> ditolak (tipe salah)', () => {
  const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(bufferMatchesImageType(buf, 'image/gif'), false);
});

test('buffer kosong -> ditolak, tidak throw', () => {
  assert.equal(bufferMatchesImageType(Buffer.from([]), 'image/jpeg'), false);
});

test('buffer lebih pendek dari tanda tangan -> ditolak, tidak throw', () => {
  assert.equal(bufferMatchesImageType(Buffer.from([0xff, 0xd8]), 'image/jpeg'), false);
});

test('contentType tak dikenal -> ditolak', () => {
  const buf = Buffer.from([0xff, 0xd8, 0xff]);
  assert.equal(bufferMatchesImageType(buf, 'image/svg+xml'), false);
});
