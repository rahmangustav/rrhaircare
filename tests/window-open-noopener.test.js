import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Bug yang diperbaiki: kirimBooking() di public/index.html membuka WhatsApp
// lewat `window.open(url, '_blank')` tanpa fitur 'noopener'. Ini setara
// dengan <a target="_blank"> tanpa rel="noopener" (celah reverse tabnabbing,
// CWE-1022) — tab wa.me yang baru dibuka tetap pegang window.opener dan bisa
// mengarahkan diam-diam tab booking situs ini ke halaman phishing. Beda dari
// tautan statis <a target="_blank">, panggilan ini dirakit lewat window.open()
// jadi tidak tersentuh test/pemindaian yang hanya mencari tag <a ...>.
//
// Tes ini memindai SUMBER ASLI file (bukan salinan tertulis ulang) untuk
// memastikan setiap panggilan window.open(...,'_blank',...) menyertakan
// 'noopener' di argumen fitur ketiga.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function findWindowOpenCalls(src) {
  return src.match(/window\.open\([^)]*\)/g) || [];
}

test('public/index.html: window.open ke tab baru selalu menyertakan noopener', () => {
  const src = readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const calls = findWindowOpenCalls(src).filter(c => c.includes("'_blank'") || c.includes('"_blank"'));
  assert.equal(calls.length, 1,
    'jumlah window.open(..., "_blank") di public/index.html berubah dari yang diharapkan — cek juga noopener-nya');
  for (const call of calls) {
    assert.match(call, /noopener/,
      `panggilan berikut membuka tab baru tanpa 'noopener' (celah reverse tabnabbing): ${call}`);
  }
});

test('tidak ada regresi: window.open booking tetap membuka url WhatsApp yang benar', () => {
  const src = readFileSync(path.join(root, 'public/index.html'), 'utf8');
  const call = findWindowOpenCalls(src).find(c => c.includes('_blank'));
  assert.ok(call, 'panggilan window.open untuk booking tidak ditemukan');
  assert.match(call, /window\.open\(url, ['"]_blank['"], ['"]noopener/);
});
