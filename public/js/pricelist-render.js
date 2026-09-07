// Render daftar harga — dipakai DUA kali dengan sumber yang sama:
//   1. di browser oleh pricelist.js (data terbaru dari /api/pricelist)
//   2. saat build oleh scripts/prerender.js (ditanam ke index.html)
// Tujuan nomor 2: 79 layanan + harga adalah aset konten utama situs ini, tapi
// sebelumnya cuma ada setelah JS jalan sehingga mesin pencari belum tentu
// melihatnya. Logikanya ditaruh di satu tempat supaya versi statis dan versi
// runtime tidak pernah berbeda.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function rupiah(n) { return 'Rp' + (Number(n) || 0).toLocaleString('id-ID'); }

// Rapikan durasi POS: "1h 50min" → "1 jam 50 mnt"
function dur(d) {
  if (!d) return '';
  return String(d)
    .replace(/(\d+)\s*h/g, '$1 jam')
    .replace(/(\d+)\s*min/g, '$1 mnt')
    .replace(/\s+/g, ' ').trim();
}

// Layanan tambahan: tidak berdiri sendiri, selalu menempel pada layanan lain
// ("Pakai Vitamin" Rp5.000, "Pasang Ext Kepang" Rp6.000). Kalau ikut dihitung,
// kartu kategori jadi bohong — "Coloring & Highlight mulai Rp6.000" padahal
// coloring beneran mulai Rp120.000. Hanya memengaruhi angka "mulai"; barisnya
// tetap tampil utuh di daftar harga dan dropdown booking.
var ADDON = /^(pakai|pasang|penambahan)\s/i;

// Urutan kategori yang diutamakan
var ORDER = ['Hair Cut', 'Blow & Styling', 'Coloring & Highlight', 'Perm & Rebonding',
  'Hair Spa & Treatment', 'Hair Extension', 'Nail Art', 'Perawatan Badan & Wajah',
  'Paket Layanan', 'Lainnya',
  // Kategori lama dari export POS sebelumnya — dipertahankan supaya urutan tetap
  // masuk akal kalau ada yang meng-import CSV versi lama.
  'Facial', 'Lulur', 'Whitening'];

// Harga yang benar-benar dibayar (promo kalau ada dan memang lebih murah).
function hargaEfektif(it) {
  return (it.promo && it.promo < it.price) ? it.promo : it.price;
}

function kelompokkan(list) {
  var groups = {};
  list.forEach(function (it) { (groups[it.category] = groups[it.category] || []).push(it); });
  var cats = Object.keys(groups).sort(function (a, b) {
    var ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
    if (ia < 0) ia = 99; if (ib < 0) ib = 99;
    return ia - ib || a.localeCompare(b);
  });
  return { groups: groups, cats: cats };
}

function barisHtml(it) {
  var d = dur(it.duration);
  var priceHtml = it.promo && it.promo < it.price
    ? '<span class="was">' + rupiah(it.price) + '</span><span class="now">' + rupiah(it.promo) + '</span>'
    : rupiah(it.price);
  var ket = it.desc ? '<span class="pk">' + esc(it.desc) + '</span>' : '';
  return '<div class="price-row' + (ket ? ' has-desc' : '') + '">' +
    '<span class="pn">' + esc(it.name) + (d ? ' <span class="pd">· ' + esc(d) + '</span>' : '') +
      ket + '</span>' +
    '<span class="leader"></span>' +
    '<span class="pp">' + priceHtml + '</span>' +
    '</div>';
}

// Akordeon: kategori tertutup secara default supaya halaman tidak memanjang.
// Isinya tetap ada di HTML, jadi tetap terbaca mesin pencari.
function akordeonHtml(list) {
  var g = kelompokkan(list);
  return g.cats.map(function (cat) {
    var rows = g.groups[cat].map(barisHtml).join('');
    return '<details class="price-cat">' +
      '<summary><h3>' + esc(cat) + '</h3>' +
      '<span class="pc-count">' + g.groups[cat].length + ' layanan</span>' +
      '<span class="pc-chev" aria-hidden="true">&#9662;</span></summary>' +
      '<div class="pc-items">' + rows + '</div>' +
      '</details>';
  }).join('');
}

// Teks kartu kategori di section atas: "18 layanan · mulai Rp20.000".
// Jumlah menghitung semua baris; harga "mulai" mengabaikan add-on.
function metaKartu(items) {
  if (!items || !items.length) return '';
  var utama = items.filter(function (it) { return !ADDON.test(it.name); });
  if (!utama.length) utama = items; // kategori yang isinya add-on semua
  var murah = Infinity;
  utama.forEach(function (it) {
    var v = hargaEfektif(it);
    if (v && v < murah) murah = v;
  });
  return items.length + ' layanan' + (murah < Infinity ? ' · mulai ' + rupiah(murah) : '');
}

// schema.org OfferCatalog — biar 79 layanan terbaca mesin pencari sebagai
// penawaran, bukan cuma teks.
function offerCatalog(list) {
  var g = kelompokkan(list);
  return {
    '@type': 'OfferCatalog',
    name: 'Daftar layanan RR Hair Care',
    itemListElement: g.cats.map(function (cat) {
      return {
        '@type': 'OfferCatalog',
        name: cat,
        itemListElement: g.groups[cat].map(function (it) {
          return {
            '@type': 'Offer',
            itemOffered: it.desc
              ? { '@type': 'Service', name: it.name, description: it.desc }
              : { '@type': 'Service', name: it.name },
            price: String(hargaEfektif(it)),
            priceCurrency: 'IDR'
          };
        })
      };
    })
  };
}

(typeof window !== 'undefined' ? window : globalThis).PricelistRender =
  { esc: esc, rupiah: rupiah, dur: dur, ADDON: ADDON, ORDER: ORDER,
    hargaEfektif: hargaEfektif, kelompokkan: kelompokkan, barisHtml: barisHtml,
    akordeonHtml: akordeonHtml, metaKartu: metaKartu, offerCatalog: offerCatalog };
