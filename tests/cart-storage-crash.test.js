import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

// public/js/cart.js dimuat sebagai <script> BIASA (bukan module) di checkout.html
// dan toko/index.html — dua-duanya halaman inti alur belanja/booking toko.
// Baris pertama IIFE-nya (dulu):
//   let items = JSON.parse(localStorage.getItem(KEY) || '[]');
// TANPA try/catch. Kalau isi localStorage['rrhc_cart'] bukan JSON valid (mis.
// sisa versi lama, diedit manual lewat devtools, ekstensi browser lain menimpa
// key yang sama, atau storage browser korup), JSON.parse melempar exception
// SYNCHRONOUS di baris pertama skrip level-atas ini. Karena ini bukan module,
// exception tak tertangani itu menghentikan SELURUH eksekusi file cart.js —
// termasuk fungsi toast()/drawer di bagian bawah file — sehingga variabel
// global `Cart` tidak pernah terbentuk. Setiap halaman yang memakainya
// (tambah ke keranjang, render drawer, checkout) langsung error
// "Cart is not defined" sampai pelanggan membersihkan localStorage manual.
//
// Tes ini menjalankan SUMBER ASLI cart.js (bukan salinan tertulis ulang) di
// sandbox node:vm dengan localStorage/document tiruan, supaya menguji kode
// yang benar-benar dikirim ke browser.

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, 'public/js/cart.js'), 'utf8');

function runCartWithStoredValue(storedRaw) {
  const store = { rrhc_cart: storedRaw };
  const localStorage = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
  const document = {
    addEventListener: () => {},
    getElementById: () => null,
    querySelectorAll: () => [],
  };
  const sandbox = { localStorage, document, window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: 'cart.js' });
  // `const Cart = ...` di top-level skrip klasik tidak jadi properti objek
  // global (sama seperti di browser sungguhan) — ambil lewat evaluasi kedua
  // di context yang sama, tempat binding lexical-nya tetap terlihat.
  sandbox.Cart = vm.runInContext('typeof Cart !== "undefined" ? Cart : undefined', sandbox);
  return sandbox;
}

test('cart.js: JSON rusak di localStorage tidak menggagalkan seluruh skrip (Cart tetap terbentuk)', () => {
  assert.doesNotThrow(() => {
    const sandbox = runCartWithStoredValue('{rusak tidak valid');
    assert.ok(sandbox.Cart, 'window.Cart harus tetap terbentuk walau data tersimpan rusak');
  });
});

test('cart.js: JSON rusak di localStorage membuat keranjang mulai dari kosong, bukan crash', () => {
  const sandbox = runCartWithStoredValue('{rusak tidak valid');
  // JSON.stringify dulu: objek array dari vm.createContext beda "realm" (beda
  // Array.prototype) dari realm test ini, jadi assert.deepEqual/deepStrictEqual
  // bisa gagal walau isinya sama persis — bukan bug di cart.js.
  assert.equal(JSON.stringify(sandbox.Cart.all()), '[]');
});

test('cart.js: localStorage berisi objek (bukan array) tidak membuat items.find/filter crash', () => {
  const sandbox = runCartWithStoredValue('{"bukan":"array"}');
  assert.equal(JSON.stringify(sandbox.Cart.all()), '[]');
});

test('cart.js: localStorage kosong (belum pernah dipakai) tetap menghasilkan keranjang kosong', () => {
  const sandbox = runCartWithStoredValue(null);
  assert.equal(JSON.stringify(sandbox.Cart.all()), '[]');
});

test('cart.js: localStorage array valid tetap dimuat seperti biasa (tidak ada regresi)', () => {
  const sandbox = runCartWithStoredValue(JSON.stringify([{ id: 'p1', name: 'Serum', price: 10000, qty: 2 }]));
  assert.equal(sandbox.Cart.count(), 2);
  assert.equal(sandbox.Cart.subtotal(), 20000);
});
