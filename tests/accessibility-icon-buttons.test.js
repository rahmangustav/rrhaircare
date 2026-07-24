import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Beberapa tombol/link ikon-saja (tanpa teks) di halaman publik tidak punya nama
// aksesibel (aria-label/title) sama sekali — pembaca layar cuma mengumumkan
// "button"/"link" tanpa tahu fungsinya (tombol buka/tutup keranjang, tambah/
// kurangi/hapus item, ikon sosial di footer, tombol WhatsApp mengambang).
// Tes ini memuat SUMBER ASLI tiap file supaya menguji kode yang benar-benar
// dikirim ke browser, bukan salinan tertulis ulang.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (f) => readFileSync(path.join(root, f), 'utf8');

test('toko/index.html: tombol buka & tutup keranjang punya aria-label', () => {
  const src = read('public/toko/index.html');
  assert.match(src, /id="cartBtn"[^>]*aria-label="[^"]+"/, 'tombol buka keranjang (cartBtn) harus punya aria-label');
  assert.match(src, /id="closeCart"[^>]*aria-label="[^"]+"/, 'tombol tutup keranjang (closeCart) harus punya aria-label');
});

test('public/js/cart.js: tombol tambah/kurangi/hapus item punya aria-label', () => {
  const src = read('public/js/cart.js');
  assert.match(src, /data-dec="\$\{i\.id\}" aria-label="[^"]*\$\{esc\(i\.name\)\}[^"]*"/,
    'tombol kurangi jumlah harus punya aria-label yang menyebut nama produknya');
  assert.match(src, /data-inc="\$\{i\.id\}" aria-label="[^"]*\$\{esc\(i\.name\)\}[^"]*"/,
    'tombol tambah jumlah harus punya aria-label yang menyebut nama produknya');
  assert.match(src, /data-rm="\$\{i\.id\}" aria-label="[^"]*\$\{esc\(i\.name\)\}[^"]*"/,
    'tombol hapus item harus punya aria-label yang menyebut nama produknya');
});

test('index.html: link sosial di footer & tombol WhatsApp mengambang punya aria-label', () => {
  const src = read('public/index.html');
  const socialHrefs = [
    'https://www.tiktok.com/@rrhaircareofficial',
    'https://www.instagram.com/rrhaircareofficial',
    'https://www.youtube.com/@rrhaircare_',
  ];
  for (const href of socialHrefs) {
    const re = new RegExp(`href="${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*class="footer-social"[^>]*aria-label="[^"]+"`);
    assert.match(src, re, `link sosial ${href} harus punya aria-label`);
  }
  assert.match(src, /class="wa-float"[^>]*aria-label="[^"]+"/, 'tombol WhatsApp mengambang harus punya aria-label');
});
