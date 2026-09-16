import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/wa-contact.js';

const { normalize, buildUrl } = globalThis.WaContact;

test('normalize: buang karakter non-digit dari nomor settings', () => {
  assert.equal(normalize('+62 813-8629-1552', '6281386291552'), '6281386291552');
});

test('normalize: settings kosong/undefined -> pakai fallback nomor default', () => {
  assert.equal(normalize('', '6281386291552'), '6281386291552');
  assert.equal(normalize(undefined, '6281386291552'), '6281386291552');
  assert.equal(normalize(null, '6281386291552'), '6281386291552');
});

test('buildUrl: sertakan pesan ter-encode sebagai query text', () => {
  assert.equal(
    buildUrl('6281386291552', 'Halo & selamat pagi'),
    'https://wa.me/6281386291552?text=Halo%20%26%20selamat%20pagi'
  );
});

test('buildUrl: tanpa pesan -> tanpa query text', () => {
  assert.equal(buildUrl('6281386291552', ''), 'https://wa.me/6281386291552');
});
