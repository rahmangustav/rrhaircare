import test from 'node:test';
import assert from 'node:assert/strict';
import { terapkanHargaResmi } from '../netlify/lib/harga-resmi.js';

const resmi = { harga: { 'Smoothing Short': 250000, 'Paket C': 105000 }, keterangan: { 'Smoothing Short': 'Harga mulai' } };

test('harga resmi menimpa nama yang sama persis, sisanya tidak disentuh', () => {
  const list = [
    { id: 'a', name: 'Smoothing Short', price: 350000, promo: 0, desc: '' },
    { id: 'b', name: 'Paket C', price: 100000, promo: 0, desc: 'isi paket' },
    { id: 'c', name: 'NailArt Simple', price: 170000, promo: 120000, desc: '' },
  ];
  const out = terapkanHargaResmi(list, resmi);
  assert.equal(out[0].price, 250000);
  assert.equal(out[0].desc, 'Harga mulai');
  assert.equal(out[1].price, 105000);
  assert.equal(out[1].desc, 'isi paket');
  assert.deepEqual(out[2], list[2]);
  assert.equal(list[0].price, 350000, 'daftar asli tidak diubah');
});

test('promo yang tidak lebih murah dari harga resmi dibuang', () => {
  const out = terapkanHargaResmi([{ name: 'Paket C', price: 100000, promo: 110000 }], resmi);
  assert.equal(out[0].promo, 0);
});

test('bukan array dikembalikan apa adanya', () => {
  assert.equal(terapkanHargaResmi(null, resmi), null);
});

test('berkas harga-resmi.json bawaan memuat Smoothing Short 250000', () => {
  const out = terapkanHargaResmi([{ name: 'Smoothing Short', price: 350000 }]);
  assert.equal(out[0].price, 250000);
});
