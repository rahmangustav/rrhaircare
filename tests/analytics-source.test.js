import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifySource } from '../netlify/lib/data.js';

// classifySource() menentukan kanal asal pengunjung untuk panel admin
// ("kanal mana yang mengisi kursi salon?") — dipakai recordHit/recordGoal.

test('campaign eksplisit menang atas referrer, alias dikenali', () => {
  assert.equal(classifySource('https://www.instagram.com/', 'ig'), 'Instagram');
  assert.equal(classifySource('https://www.facebook.com/', 'wa'), 'WhatsApp');
});

test('campaign tak dikenal -> huruf pertama dikapitalkan apa adanya', () => {
  assert.equal(classifySource('', 'flyer'), 'Flyer');
});

test('campaign dipotong ke 40 karakter sebelum diproses', () => {
  const long = 'a'.repeat(50);
  const r = classifySource('', long);
  assert.equal(r.length, 40);
});

test('tanpa ref dan tanpa campaign -> Langsung', () => {
  assert.equal(classifySource('', ''), 'Langsung');
  assert.equal(classifySource(undefined, undefined), 'Langsung');
});

test('ref bukan URL valid -> Langsung (tidak throw)', () => {
  assert.equal(classifySource('bukan-url', ''), 'Langsung');
  assert.equal(classifySource('   ', ''), 'Langsung');
});

test('navigasi internal (host sama dengan selfHost) -> string kosong', () => {
  assert.equal(classifySource('https://rrhaircare.id/toko', '', 'rrhaircare.id'), '');
  assert.equal(classifySource('https://www.rrhaircare.id/', '', 'rrhaircare.id'), '');
  assert.equal(classifySource('https://checkout.rrhaircare.id/', '', 'rrhaircare.id'), '');
});

test('host eksternal dikenali per platform', () => {
  assert.equal(classifySource('https://www.youtube.com/watch?v=x', ''), 'YouTube');
  assert.equal(classifySource('https://youtu.be/abc', ''), 'YouTube');
  assert.equal(classifySource('https://www.instagram.com/p/x', ''), 'Instagram');
  assert.equal(classifySource('https://m.facebook.com/', ''), 'Facebook');
  assert.equal(classifySource('https://www.tiktok.com/@x', ''), 'TikTok');
  assert.equal(classifySource('https://wa.me/62812', ''), 'WhatsApp');
  assert.equal(classifySource('https://www.bing.com/search', ''), 'Mesin Pencari Lain');
  assert.equal(classifySource('https://search.yahoo.com/', ''), 'Mesin Pencari Lain');
  assert.equal(classifySource('https://duckduckgo.com/', ''), 'Mesin Pencari Lain');
  assert.equal(classifySource('https://www.threads.net/', ''), 'Threads');
});

test('Google dikenali termasuk domain negara (ccTLD dua-bagian)', () => {
  assert.equal(classifySource('https://www.google.com/search?q=x', ''), 'Google Penelusuran');
  assert.equal(classifySource('https://www.google.co.id/search?q=x', ''), 'Google Penelusuran');
  assert.equal(classifySource('https://www.google.com.br/', ''), 'Google Penelusuran');
  assert.equal(classifySource('https://translate.google.com/', ''), 'Google Penelusuran');
});

test('BUG: domain mirip-Google (bukan Google asli) tidak boleh salah tercatat', () => {
  // Sebelum perbaikan, regex /(^|\.)google\./ tanpa akhiran cocok dengan
  // host APA SAJA yang diawali "google." — termasuk domain palsu/lookalike
  // seperti "google.evil-tracker.com" — beda dari 7 pola sumber lain yang
  // semuanya diakhiri `$`. Referrer bebas dikendalikan klien, jadi sumber
  // manapun yang bukan Google asli seharusnya jatuh ke nama host apa adanya.
  assert.equal(classifySource('https://google.evil-tracker.com/', ''), 'google.evil-tracker.com');
  assert.notEqual(classifySource('https://google.evil-tracker.com/', ''), 'Google Penelusuran');
});

test('host tak dikenal -> nama host apa adanya, dipotong ke 60 karakter', () => {
  assert.equal(classifySource('https://contoh-lain.co/', ''), 'contoh-lain.co');
  const longHost = 'a'.repeat(80) + '.com';
  const r = classifySource('https://' + longHost + '/', '');
  assert.equal(r.length, 60);
});

test('prefix www. dibuang sebelum pencocokan host', () => {
  assert.equal(classifySource('https://www.tiktok.com/@x', ''), 'TikTok');
});
