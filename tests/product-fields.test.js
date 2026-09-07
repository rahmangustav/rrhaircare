import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProductFields } from '../netlify/lib/data.js';

// Bug yang diperbaiki: admin-products.js dulu menghitung `active` tanpa
// syarat (`b.active !== false && b.active !== 'false'`), yang SELALU
// bernilai boolean (tidak pernah `undefined`). Baris pembersihan PUT
// ("hapus field yang undefined agar tidak menimpa") jadi tidak pernah
// membuang `active` -> tiap PUT edit produk (mis. cuma ubah harga/stok,
// klien mana pun yang tidak mengirim `active`) diam-diam memaksa produk
// jadi aktif lagi, walau sebelumnya sengaja dinonaktifkan.

test('active tidak dikirim -> field active TIDAK disertakan (PUT tidak menimpa status sebelumnya)', () => {
  const fields = buildProductFields({ name: 'Sampo', price: 50000 });
  assert.equal('active' in fields, false);
});

test('active: false eksplisit -> disertakan sebagai false', () => {
  const fields = buildProductFields({ name: 'Sampo', active: false });
  assert.equal(fields.active, false);
});

test('active: true eksplisit -> disertakan sebagai true', () => {
  const fields = buildProductFields({ name: 'Sampo', active: true });
  assert.equal(fields.active, true);
});

test('active: "false" (string, dari form) -> tetap dianggap nonaktif', () => {
  const fields = buildProductFields({ name: 'Sampo', active: 'false' });
  assert.equal(fields.active, false);
});

test('field lain tetap terisi apa adanya', () => {
  const fields = buildProductFields({ name: 'Sampo', category: 'Rambut', price: 1000, stock: 5, description: 'x' });
  assert.equal(fields.name, 'Sampo');
  assert.equal(fields.category, 'Rambut');
  assert.equal(fields.price, 1000);
  assert.equal(fields.stock, 5);
  assert.equal(fields.description, 'x');
});

// ── Baris pesanan menyimpan kategori produk ──
// Di katalog ada empat pasang produk yang namanya persis sama dan hanya beda
// kategori: "Treat & Care 1000ml", "Magia Keratin 200ml", "Magia Plex 250ml",
// dan "Magia Scalp 250ml (Ketombe)" masing-masing punya versi Shampo dan versi
// Conditioner/Hair Scrub. Kartu produk di toko menampilkan kategorinya, tapi
// keranjang dan rincian pesanan dulu cuma menyimpan nama — jadi pesanan yang
// masuk ke admin tidak bisa dipastikan yang mana.
import { buildOrderItem } from '../netlify/lib/data.js';

test('baris pesanan membawa kategori produk', () => {
  const item = buildOrderItem(
    { id: 'p_1', name: 'Treat & Care 1000ml', category: 'Conditioner', price: 80000, stock: 20 }, 2);
  assert.deepEqual(item,
    { id: 'p_1', name: 'Treat & Care 1000ml', price: 80000, qty: 2, category: 'Conditioner' });
});

test('produk tanpa kategori tetap menghasilkan baris yang sah', () => {
  const item = buildOrderItem({ id: 'p_2', name: 'X', price: 1000 }, 1);
  assert.equal(item.category, '');
});

test('qty tak masuk akal dibulatkan ke minimal 1, bukan 0 atau NaN', () => {
  assert.equal(buildOrderItem({ id: 'p', name: 'X', price: 1 }, 0).qty, 1);
  assert.equal(buildOrderItem({ id: 'p', name: 'X', price: 1 }, -5).qty, 1);
  assert.equal(buildOrderItem({ id: 'p', name: 'X', price: 1 }, 'abc').qty, 1);
});

test('harga & nama diambil dari catatan produk, bukan dari yang dikirim klien', () => {
  // buildOrderItem hanya menerima produk tepercaya; tidak ada jalan bagi body
  // request untuk menyelipkan harga sendiri lewat fungsi ini.
  const item = buildOrderItem({ id: 'p', name: 'Asli', price: 95000, category: 'Creambath' }, 1);
  assert.equal(item.price, 95000);
  assert.equal(item.name, 'Asli');
});
