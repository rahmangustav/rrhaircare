import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/js/pricelist-render.js';

const R = globalThis.PricelistRender;

const contoh = [
  { category: 'Coloring & Highlight', name: 'Pasang Ext Kepang 2*3', price: 6000, promo: 0, duration: '' },
  { category: 'Coloring & Highlight', name: 'Jasa Cat', price: 120000, promo: 0, duration: '' },
  { category: 'Coloring & Highlight', name: 'Colouring', price: 250000, promo: 0, duration: '1h 30min' },
  { category: 'Nail Art', name: 'NailArt Simple', price: 170000, promo: 120000, duration: '' },
];

test('metaKartu: add-on tidak boleh jadi harga pembuka', () => {
  const coloring = contoh.filter(x => x.category === 'Coloring & Highlight');
  // Rp6.000 itu "Pasang Ext Kepang" — add-on, bukan layanan coloring.
  assert.equal(R.metaKartu(coloring), '3 layanan · mulai Rp120.000');
});

test('metaKartu: jumlah tetap menghitung add-on, hanya harga yang mengabaikannya', () => {
  const coloring = contoh.filter(x => x.category === 'Coloring & Highlight');
  assert.match(R.metaKartu(coloring), /^3 layanan/);
});

test('metaKartu: kategori yang isinya add-on semua tetap punya harga', () => {
  const cuma = [{ category: 'X', name: 'Pakai Vitamin', price: 5000, promo: 0 }];
  assert.equal(R.metaKartu(cuma), '1 layanan · mulai Rp5.000');
});

test('metaKartu: harga promo dipakai kalau lebih murah', () => {
  const nail = contoh.filter(x => x.category === 'Nail Art');
  assert.equal(R.metaKartu(nail), '1 layanan · mulai Rp120.000');
});

test('akordeonHtml: nama layanan di-escape, tidak bisa nyuntik markup', () => {
  const jahat = [{ category: 'X', name: '<img src=x onerror=alert(1)>', price: 1000, promo: 0 }];
  const html = R.akordeonHtml(jahat);
  assert.ok(!html.includes('<img src=x'), 'markup mentah bocor ke output');
  assert.ok(html.includes('&lt;img src=x'), 'seharusnya ter-escape');
});

test('akordeonHtml: tiap kategori jadi <details> dengan <h3> — terbaca mesin pencari', () => {
  const html = R.akordeonHtml(contoh);
  assert.equal((html.match(/<details class="price-cat">/g) || []).length, 2);
  assert.ok(html.includes('<h3>Coloring &amp; Highlight</h3>'));
  assert.ok(html.includes('Jasa Cat'), 'nama layanan harus ada di HTML');
  assert.ok(html.includes('Rp120.000'), 'harga harus ada di HTML');
});

test('akordeonHtml: promo tampil sebagai harga coret + harga baru', () => {
  const html = R.akordeonHtml(contoh.filter(x => x.category === 'Nail Art'));
  assert.ok(html.includes('<span class="was">Rp170.000</span>'));
  assert.ok(html.includes('<span class="now">Rp120.000</span>'));
});

test('dur: durasi POS dirapikan ke bahasa Indonesia', () => {
  assert.equal(R.dur('1h 30min'), '1 jam 30 mnt');
  assert.equal(R.dur(''), '');
});

test('offerCatalog: tiap layanan jadi Offer dengan harga efektif', () => {
  const oc = R.offerCatalog(contoh);
  assert.equal(oc['@type'], 'OfferCatalog');
  assert.equal(oc.itemListElement.length, 2, 'dua kategori');
  const nail = oc.itemListElement.find(c => c.name === 'Nail Art');
  assert.equal(nail.itemListElement[0].price, '120000', 'harga promo yang dipakai');
  assert.equal(nail.itemListElement[0].priceCurrency, 'IDR');
});
