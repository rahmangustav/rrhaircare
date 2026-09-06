import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/img-cdn.js';

const { fotoCdn, fallbackOnError } = globalThis.ImgCdn;

test('fotoCdn: foto unggahan dialihkan ke Image CDN dengan lebar yang diminta', () => {
  const u = fotoCdn('/api/media/abc.jpg', 840);
  assert.ok(u.startsWith('/.netlify/images?url='));
  assert.ok(u.includes('w=840'));
  assert.ok(u.includes('fm=webp'));
});

test('fotoCdn: URL di-encode supaya query tidak rusak', () => {
  assert.ok(fotoCdn('/api/media/a b.jpg', 400).includes('%2Fapi%2Fmedia%2Fa%20b.jpg'));
});

test('fotoCdn: aset selain /api/media dibiarkan apa adanya', () => {
  assert.equal(fotoCdn('/img/logo.png', 800), '/img/logo.png');
  assert.equal(fotoCdn('', 800), '');
  assert.equal(fotoCdn(null, 800), null);
});

test('fallbackOnError: kutip tunggal di URL tidak boleh memutus atribut', () => {
  const h = fallbackOnError("/api/media/o'brien.jpg");
  assert.ok(!h.includes("o'brien"), 'kutip tunggal harus dinetralkan');
  assert.ok(h.includes('%27'));
});
