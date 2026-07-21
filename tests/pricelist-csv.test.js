import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePricelistCsv } from '../netlify/lib/data.js';

// Bug yang diperbaiki: importPricelistCsv() dulu menimpa SELURUH daftar harga
// (Netlify Blobs, tanpa backup) dengan hasil parsePricelistCsv() apa pun isinya,
// termasuk array kosong. parsePricelistCsv() sendiri sengaja mengembalikan []
// untuk header yang tak dikenali (bukan throw) -- itu bukan bug di sini, tapi
// kalau [] itu diteruskan begitu saja ke savePricelist(), admin yang salah pilih
// file kehilangan seluruh daftar harga salon dan pesan yang tampil justru
// "Berhasil import 0 layanan". Test ini mengunci kontrak parsePricelistCsv():
// header tak dikenali / teks kosong / baris tak valid semua harus balik [],
// supaya pemanggil (importPricelistCsv) tahu kapan wajib menolak, bukan menimpa.

const HEADER = 'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration';

test('CSV kosong -> []', () => {
  assert.deepEqual(parsePricelistCsv(''), []);
  assert.deepEqual(parsePricelistCsv('   \n  \n'), []);
  assert.deepEqual(parsePricelistCsv(undefined), []);
});

test('header tak dikenali (format lain / file salah) -> []', () => {
  const csv = 'Nama,Harga\nCreambath,50000';
  assert.deepEqual(parsePricelistCsv(csv), []);
});

test('header dikenali tapi tanpa baris data -> []', () => {
  assert.deepEqual(parsePricelistCsv(HEADER), []);
});

test('semua baris data tak valid (nama kosong / harga 0) -> []', () => {
  const csv = HEADER + '\n' +
    'Service,Hair,Hair,,50000,,30\n' +          // nama kosong -> dilewati
    'Service,Hair,Hair,Creambath,0,,30';         // harga 0 -> dilewati
  assert.deepEqual(parsePricelistCsv(csv), []);
});

test('CSV valid -> baris data dikonversi jadi item pricelist', () => {
  const csv = HEADER + '\n' +
    'Service,Hair Treatment,Hair,Creambath,50000,,45';
  const items = parsePricelistCsv(csv);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Creambath');
  assert.equal(items[0].price, 50000);
  assert.equal(items[0].category, 'Hair Treatment');
});

test('kolom Retail Price hilang dari header -> []', () => {
  const csv = 'Type,Treatment Name,Group Name,Item Name,Duration\nService,Hair,Hair,Creambath,30';
  assert.deepEqual(parsePricelistCsv(csv), []);
});
