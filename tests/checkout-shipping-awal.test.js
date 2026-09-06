import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Di checkout, opsi ongkir PERTAMA sudah ter-centang sejak markup dibuat
// (idx===0 -> checked) dan chosenShip langsung diisi opsi itu. Tapi ringkasan
// harga terakhir dihitung di renderSummary(), yang jalan SEBELUM renderShip().
// Sebelum perbaikan ini, ringkasan menempel di "Ongkir: Gratis" sampai pembeli
// mengklik opsi LAIN — jadi layar menampilkan total tanpa ongkir sementara
// server tetap menagih ongkir (shippingId opsi pertama tetap ikut terkirim).
// Tes memuat SUMBER ASLI checkout.html supaya yang diuji benar-benar kode yang
// dikirim ke browser.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Elemen DOM palsu seadanya — cukup untuk menampung apa yang disentuh skrip.
function elemenPalsu() {
  return {
    innerHTML: '', textContent: '', value: '', href: '', disabled: false, files: [],
    dataset: {}, style: {},
    addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
}

async function jalankanCheckout({ shippingOptions, subtotal }) {
  const html = readFileSync(path.join(root, 'public/checkout.html'), 'utf8');
  // Ambil blok <script> inline terakhir (yang tanpa atribut src).
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const src = inline[inline.length - 1];
  assert.ok(src && src.includes('function renderShip'), 'skrip checkout tidak ketemu');

  const elemen = new Map();
  const document = {
    getElementById(id) {
      if (!elemen.has(id)) elemen.set(id, elemenPalsu());
      return elemen.get(id);
    },
  };
  const Cart = { all: () => [{ id: 'p1', name: 'Produk', price: subtotal, qty: 1 }],
                 subtotal: () => subtotal, clear() {} };
  const fetchPalsu = async () => ({ ok: true, json: async () => ({ shippingOptions }) });

  new Function('document', 'window', 'Cart', 'fetch', 'location', src)(
    document, { scrollTo() {} }, Cart, fetchPalsu, { href: '' });

  // Beri kesempatan init() yang async selesai.
  for (let i = 0; i < 5; i++) await Promise.resolve();
  await new Promise(r => setImmediate(r));
  return elemen;
}

test('ringkasan checkout langsung memakai ongkir opsi pertama yang ter-centang', async () => {
  const el = await jalankanCheckout({
    shippingOptions: [
      { id: 'jabodetabek', label: 'Jabodetabek', price: 15000 },
      { id: 'jawa', label: 'Pulau Jawa', price: 25000 },
    ],
    subtotal: 140000,
  });
  assert.equal(el.get('sShip').textContent, 'Rp15.000',
    'ongkir di ringkasan harus ikut opsi pertama, bukan "Gratis"');
  assert.equal(el.get('sTotal').textContent, 'Rp155.000',
    'total di layar harus sama dengan yang akan ditagih server');
});

test('opsi pertama gratis tetap tampil "Gratis" dan total = subtotal', async () => {
  const el = await jalankanCheckout({
    shippingOptions: [
      { id: 'ambil', label: 'Ambil di salon', price: 0 },
      { id: 'jabodetabek', label: 'Jabodetabek', price: 15000 },
    ],
    subtotal: 90000,
  });
  assert.equal(el.get('sShip').textContent, 'Gratis');
  assert.equal(el.get('sTotal').textContent, 'Rp90.000');
});

test('tanpa opsi ongkir sama sekali, total tidak jadi NaN', async () => {
  const el = await jalankanCheckout({ shippingOptions: [], subtotal: 50000 });
  assert.equal(el.get('sShip').textContent, 'Gratis');
  assert.equal(el.get('sTotal').textContent, 'Rp50.000');
});
