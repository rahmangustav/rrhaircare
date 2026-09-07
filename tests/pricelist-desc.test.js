import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePricelistCsv } from '../netlify/lib/data.js';
import '../public/js/pricelist-render.js';

const R = globalThis.PricelistRender;

// Latar: 18 "Paket Layanan" dulu tampil di situs hanya sebagai "Paket 1
// Rp160.000" — tanpa satu pun keterangan isinya. Itu bertabrakan dengan janji
// utama situs ("harga ditulis lengkap, bukan hubungi kami"). Sekarang tiap item
// harga punya field `desc` yang ikut terbaca dari kolom Description di CSV POS,
// tampil sebagai baris kecil di bawah nama, dan ikut masuk schema.org.

const HEADER = 'Type,Treatment Name,Group Name,Item Name,Description,Retail Price,Special Price,Duration';

test('kolom Description di CSV terbaca jadi desc', () => {
  const csv = HEADER + '\n' +
    '"Package","Paket Layanan","Paket Layanan","Paket 1","2 layanan, hemat Rp60.000","160.000,00","0,00",""';
  const [item] = parsePricelistCsv(csv);
  assert.equal(item.name, 'Paket 1');
  assert.equal(item.desc, '2 layanan, hemat Rp60.000');
});

test('CSV lama tanpa kolom Description tetap terbaca, desc jadi string kosong', () => {
  const lama = 'Type,Treatment Name,Group Name,Item Name,Retail Price,Special Price,Duration\n' +
    '"Service","Hair Cut","Hair Cut","Cut Bangs","10.000,00","0,00","5min"';
  const [item] = parsePricelistCsv(lama);
  assert.equal(item.name, 'Cut Bangs');
  assert.equal(item.desc, '');
});

test('desc dibatasi 160 karakter supaya tidak merusak baris harga', () => {
  const csv = HEADER + '\n' +
    `"Service","Lainnya","Lainnya","X","${'a'.repeat(300)}","5.000,00","0,00",""`;
  assert.equal(parsePricelistCsv(csv)[0].desc.length, 160);
});

test('barisHtml menampilkan desc dan menandai barisnya', () => {
  const html = R.barisHtml({ name: 'Paket 1', price: 160000, promo: 0, duration: '', desc: '2 layanan' });
  assert.match(html, /class="price-row has-desc"/);
  assert.match(html, /<span class="pk">2 layanan<\/span>/);
});

test('tanpa desc, baris harga tetap seperti semula', () => {
  const html = R.barisHtml({ name: 'Cut Bangs', price: 10000, promo: 0, duration: '5min' });
  assert.match(html, /class="price-row"/);
  assert.doesNotMatch(html, /class="pk"/);
});

test('desc di-escape — teks dari admin tidak boleh jadi HTML', () => {
  const html = R.barisHtml({ name: 'X', price: 1000, promo: 0, duration: '', desc: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img/);
});

test('offerCatalog memakai desc sebagai description layanan', () => {
  const cat = R.offerCatalog([
    { category: 'Paket Layanan', name: 'Paket 1', price: 160000, promo: 0, duration: '', desc: '2 layanan' },
    { category: 'Hair Cut', name: 'Cut Bangs', price: 10000, promo: 0, duration: '5min' },
  ]);
  const semua = cat.itemListElement.flatMap(k => k.itemListElement);
  const paket = semua.find(o => o.itemOffered.name === 'Paket 1');
  const potong = semua.find(o => o.itemOffered.name === 'Cut Bangs');
  assert.equal(paket.itemOffered.description, '2 layanan');
  // Tanpa desc, jangan tanam key description kosong ke schema.
  assert.equal('description' in potong.itemOffered, false);
});

test('kategori hasil perapian daftar harga punya urutan yang ditentukan', () => {
  const { cats } = R.kelompokkan([
    { category: 'Lainnya', name: 'a', price: 1 },
    { category: 'Paket Layanan', name: 'b', price: 1 },
    { category: 'Perawatan Badan & Wajah', name: 'c', price: 1 },
    { category: 'Hair Extension', name: 'd', price: 1 },
    { category: 'Hair Cut', name: 'e', price: 1 },
  ]);
  assert.deepEqual(cats,
    ['Hair Cut', 'Hair Extension', 'Perawatan Badan & Wajah', 'Paket Layanan', 'Lainnya']);
});

// ── Kunci hasil perapian daftar harga (csv/harga-rapi.csv) ──
// Dihasilkan oleh scripts/rapikan-csv.js dari export POS. Test ini menjaga tiga
// hal yang jadi alasan file itu dibuat, supaya tidak diam-diam kembali rusak
// kalau suatu saat generatornya dijalankan ulang atas export baru.
import { readFileSync, existsSync } from 'node:fs';

const RAPI = new URL('../csv/harga-rapi.csv', import.meta.url);

test('harga-rapi.csv: tidak ada layanan kembar', { skip: !existsSync(RAPI) }, () => {
  const list = parsePricelistCsv(readFileSync(RAPI, 'utf8'));
  assert.ok(list.length > 60, 'daftar terbaca');
  // Normalisasi longgar: beda spasi/kapital/tanda baca dianggap sama nama
  // ("NailArt Simple" vs "PROMO Nail Art Simple"), tapi angka DIPERTAHANKAN —
  // Paket 1 dan Paket 2 memang layanan berbeda.
  const kunci = list.map(x => x.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const kembar = kunci.filter((k, i) => kunci.indexOf(k) !== i);
  assert.deepEqual(kembar, [], 'nama yang muncul dua kali: ' + kembar.join(', '));
});

test('harga-rapi.csv: durasi 5 menit tak lagi menempel di layanan mahal', { skip: !existsSync(RAPI) }, () => {
  const list = parsePricelistCsv(readFileSync(RAPI, 'utf8'));
  // "5min" adalah nilai bawaan POS yang tak pernah diisi. Untuk layanan seharga
  // ratusan ribu jelas mustahil, dan angka salah lebih buruk daripada kosong.
  const janggal = list.filter(x => x.duration === '5min' && x.price >= 50000);
  assert.deepEqual(janggal.map(x => x.name), []);
});

test('harga-rapi.csv: tiap paket punya keterangan isi', { skip: !existsSync(RAPI) }, () => {
  const paket = parsePricelistCsv(readFileSync(RAPI, 'utf8'))
    .filter(x => x.category === 'Paket Layanan');
  assert.equal(paket.length, 18);
  const kosong = paket.filter(p => !p.desc).map(p => p.name);
  assert.deepEqual(kosong, []);
});
