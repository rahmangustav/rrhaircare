// Tanam daftar harga ke public/index.html saat build.
//
// Kenapa: 79 layanan + harga adalah aset konten utama situs ini ("harga ditulis
// lengkap di halaman ini, bukan hubungi kami"), tapi sebelumnya baru muncul
// setelah JS jalan — mesin pencari belum tentu melihatnya. Sekarang isinya ada
// di HTML sejak awal; di browser tetap ditimpa data terbaru oleh pricelist.js,
// jadi harga yang diubah di admin langsung tampil tanpa menunggu deploy.
//
// Sumber data, berurutan:
//   1. API situs yang sedang live (hasil deploy sebelumnya)
//   2. snapshot yang ikut ter-commit, kalau API tak terjangkau saat build
// Kalau dua-duanya gagal, file tidak disentuh dan build tetap lanjut —
// halaman jatuh ke perilaku lama (diisi JS). Aman dijalankan berulang kali.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import '../public/js/pricelist-render.js';
import '../public/js/img-cdn.js';

const R = globalThis.PricelistRender;
const C = globalThis.ImgCdn;
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const HTML = path.join(root, 'public/index.html');
const SNAPSHOT = path.join(root, 'data/pricelist-snapshot.json');
const API = process.env.PRERENDER_API || 'https://rrhaircare.id/api/pricelist';

function log(...a) { console.log('[prerender]', ...a); }

async function ambilJson(url, snapshot, label) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const list = await res.json();
    if (!Array.isArray(list) || !list.length) throw new Error('daftar kosong');
    log(`${label}: ambil dari API, ${list.length} baris`);
    mkdirSync(path.dirname(snapshot), { recursive: true });
    writeFileSync(snapshot, JSON.stringify(list, null, 2) + '\n');
    return list;
  } catch (e) {
    log(`${label}: API tidak terpakai (${e.message}), coba snapshot`);
    if (!existsSync(snapshot)) return null;
    try {
      const list = JSON.parse(readFileSync(snapshot, 'utf8'));
      if (!Array.isArray(list) || !list.length) return null;
      log(`${label}: ambil dari snapshot, ${list.length} baris`);
      return list;
    } catch { return null; }
  }
}

// Ganti isi di antara dua penanda. Idempoten: penandanya tetap tinggal.
function gantiBlok(html, nama, isi) {
  const re = new RegExp(`(<!-- prerender:${nama}:mulai -->)[\\s\\S]*?(<!-- prerender:${nama}:selesai -->)`);
  if (!re.test(html)) throw new Error(`penanda "${nama}" tidak ada di index.html`);
  return html.replace(re, (_m, a, b) => a + isi + b);
}

const list = await ambilJson(API, SNAPSHOT, 'layanan');
if (!list) {
  log('tidak ada data — index.html dibiarkan apa adanya, build lanjut');
  process.exit(0);
}

let html = readFileSync(HTML, 'utf8');
const { groups } = R.kelompokkan(list);

// 1. Isi akordeon daftar harga.
html = gantiBlok(html, 'harga', '\n' + R.akordeonHtml(list) + '\n    ');

// 2. Teks meta tiap kartu kategori ("18 layanan · mulai Rp20.000").
let kartu = 0;
html = html.replace(
  /(<div class="service-card" data-kategori="([^"]+)">[\s\S]*?<div class="service-meta">)([^<]*)(<\/div>)/g,
  (m, awal, kategori, _lama, akhir) => {
    const items = groups[kategori.replace(/&amp;/g, '&')];
    if (!items || !items.length) return m;
    kartu++;
    return awal + R.esc(R.metaKartu(items)) + akhir;
  });

// 3. Angka "N layanan" yang sebelumnya di-hardcode di 3 tempat.
let angka = 0;
html = html.replace(/(<span data-jumlah-layanan>)[^<]*(<\/span>)/g,
  (_m, a, b) => { angka++; return a + list.length + b; });

// 4. schema.org OfferCatalog, menempel ke entitas salon lewat @id.
const schema = {
  '@context': 'https://schema.org',
  '@id': 'https://rrhaircare.id/#salon',
  hasOfferCatalog: R.offerCatalog(list)
};
html = gantiBlok(html, 'layanan-schema',
  '\n  <script type="application/ld+json">\n  ' + JSON.stringify(schema) + '\n  </script>\n  ');

log(`selesai: ${list.length} layanan, ${kartu} kartu, ${angka} penanda angka, schema OfferCatalog ditanam`);

// ── Foto tetap: hero & about ditanam, bukan menunggu JS ──────────────────────
// Foto hero adalah elemen terbesar di layar (LCP). Sebelumnya baru dipasang
// setelah JS jalan DAN dua panggilan API selesai, jadi selalu muncul paling
// akhir. Sekarang <img>-nya sudah ada di HTML plus preload di <head>.
// gallery.js tetap menimpanya saat runtime dengan URL yang sama persis, jadi
// tidak ada unduhan ganda dan foto baru dari admin tetap langsung tampil.
const galeri = await ambilJson(
  process.env.PRERENDER_API_GALERI || 'https://rrhaircare.id/api/gallery',
  path.join(root, 'data/galeri-snapshot.json'), 'galeri') || [];

let siteImages = {};
try {
  const res = await fetch(process.env.PRERENDER_API_SITEIMG || 'https://rrhaircare.id/api/site-images');
  if (res.ok) siteImages = await res.json();
  writeFileSync(path.join(root, 'data/site-images-snapshot.json'), JSON.stringify(siteImages, null, 2) + '\n');
} catch {
  const f = path.join(root, 'data/site-images-snapshot.json');
  if (existsSync(f)) { try { siteImages = JSON.parse(readFileSync(f, 'utf8')); } catch { /* biarkan kosong */ } }
}
log(`slot foto tetap: ${Object.keys(siteImages).length} terisi, galeri ${galeri.length} foto`);

const LEBAR = { hero: 840, about: 800 };
function imgHtml(url, alt, lebar, hero) {
  const src = C.fotoCdn(url, lebar);
  return `<img src="${R.esc(src)}" data-full="${R.esc(C.fotoCdn(url, 1400))}" alt="${R.esc(alt)}"`
    + (hero ? ' fetchpriority="high"' : ' loading="lazy"')
    + ` onerror="${R.esc(C.fallbackOnError(url))}"/>`;
}

// Sumber tiap slot, persis aturan di gallery.js.
function sumberSlot(slot) {
  if (siteImages[slot]) return { url: siteImages[slot], alt: 'RR Hair Care' };
  if (slot === 'hero' && galeri.length) {
    return { url: galeri[0].image, alt: galeri[0].caption || 'Hasil kerja RR Hair Care' };
  }
  return null;
}

let fotoHero = null, slotIsi = 0, slotSembunyi = 0;
html = html.replace(/<div([^>]*?)data-slot="([^"]+)"([^>]*?)>[\s\S]*?<\/div>/g, (m, a, slot, b) => {
  const src = sumberSlot(slot);
  // Atribut hidden dari hasil build sebelumnya dilepas dulu supaya skrip ini
  // aman dijalankan berulang kali.
  const sisa = b.replace(/\s*\bhidden\b/g, '');
  if (!src) {
    // Slot kosong jangan tampil sebagai kotak melompong. Disembunyikan, BUKAN
    // dihapus — supaya foto yang nanti diunggah lewat admin tetap bisa dipasang
    // gallery.js tanpa menunggu deploy berikutnya.
    slotSembunyi++;
    return `<div${a}data-slot="${slot}"${sisa} hidden></div>`;
  }
  slotIsi++;
  if (slot === 'hero') fotoHero = C.fotoCdn(src.url, LEBAR.hero);
  return `<div${a}data-slot="${slot}"${sisa}>`
    + imgHtml(src.url, src.alt, LEBAR[slot] || 720, slot === 'hero') + '</div>';
});

html = gantiBlok(html, 'preload-hero', fotoHero
  ? `\n  <link rel="preload" as="image" href="${R.esc(fotoHero)}" fetchpriority="high"/>\n  `
  : '');
log(`foto tetap: ${slotIsi} slot diisi, ${slotSembunyi} slot kosong disembunyikan, preload hero: ${fotoHero ? 'ya' : 'tidak'}`);

writeFileSync(HTML, html);

// ── Halaman toko: schema Product untuk tiap barang ───────────────────────────
// Grid produknya tetap dirender JS (markup + listener-nya menyatu di halaman),
// tapi schema-nya bisa ditanam supaya harga & ketersediaan terbaca mesin
// pencari dan berpeluang muncul sebagai rich result.
const TOKO = path.join(root, 'public/toko/index.html');
const SNAP_PRODUK = path.join(root, 'data/produk-snapshot.json');
const API_PRODUK = process.env.PRERENDER_API_PRODUK || 'https://rrhaircare.id/api/products';

const produk = await ambilJson(API_PRODUK, SNAP_PRODUK, 'produk');
if (produk) {
  const aktif = produk.filter((p) => p.active !== false);
  const schemaProduk = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Produk perawatan rambut RR Hair Care',
    numberOfItems: aktif.length,
    itemListElement: aktif.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        ...(p.description ? { description: p.description } : {}),
        ...(p.category ? { category: p.category } : {}),
        ...(p.image ? { image: 'https://rrhaircare.id' + p.image } : {}),
        offers: {
          '@type': 'Offer',
          price: String(p.price),
          priceCurrency: 'IDR',
          availability: (p.stock > 0)
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
          url: 'https://rrhaircare.id/toko',
          seller: { '@id': 'https://rrhaircare.id/#salon' }
        }
      }
    }))
  };
  let tokoHtml = readFileSync(TOKO, 'utf8');
  tokoHtml = gantiBlok(tokoHtml, 'produk-schema',
    '\n<script type="application/ld+json">\n' + JSON.stringify(schemaProduk) + '\n</script>\n');
  writeFileSync(TOKO, tokoHtml);
  log(`toko: schema Product untuk ${aktif.length} produk ditanam`);
} else {
  log('toko: tidak ada data produk — dilewati');
}

// ── sitemap.xml dengan lastmod ───────────────────────────────────────────────
// Tanggal build dipakai sebagai lastmod: isi halaman memang ikut berubah tiap
// deploy karena daftar harga & produk ditanam ulang di sini.
const tanggal = new Date().toISOString().slice(0, 10);
const halaman = [
  { loc: 'https://rrhaircare.id/', changefreq: 'weekly', priority: '1.0' },
  { loc: 'https://rrhaircare.id/toko', changefreq: 'weekly', priority: '0.8' },
  // Ketentuan belanja, pengembalian & privasi. Jarang berubah, tapi tetap perlu
  // terindeks — halaman ini yang dirujuk dari checkout sebelum orang membayar.
  { loc: 'https://rrhaircare.id/kebijakan', changefreq: 'yearly', priority: '0.3' },
];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n'
  + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
  + halaman.map((h) => '  <url>\n'
      + `    <loc>${h.loc}</loc>\n`
      + `    <lastmod>${tanggal}</lastmod>\n`
      + `    <changefreq>${h.changefreq}</changefreq>\n`
      + `    <priority>${h.priority}</priority>\n`
      + '  </url>\n').join('')
  + '</urlset>\n';
writeFileSync(path.join(root, 'public/sitemap.xml'), sitemap);
log(`sitemap.xml diperbarui, lastmod ${tanggal}`);
