// Rapikan export POS (csv/service.csv) jadi daftar harga siap tayang (csv/harga-rapi.csv).
//
// Export mentah dari POS punya beberapa masalah yang kelihatan di halaman publik:
//   1. Nail art tertulis dua kali — baris "PROMO X" (harga akhir) dan baris "X"
//      (harga coret + promo). Pelanggan lihat layanan yang sama dua kali.
//   2. Ratus juga dobel: "Ratus Vagina" di Hair Spa dan "PROMO Ratus Mis-V" di Lulur.
//   3. Durasi "5min" adalah nilai bawaan POS yang tak pernah diisi — dipakai 26 baris,
//      termasuk Smoothing Short Rp350.000 dan Colouring Rp250.000. Untuk layanan yang
//      jelas tak mungkin 5 menit, durasinya DIKOSONGKAN (lebih baik tidak ada
//      keterangan daripada keterangan yang salah) sampai salon mengisi angka aslinya.
//   4. Perawatan badan & wajah nyasar di kategori "Hair Spa & Treatment", pemasangan
//      extension nyasar di "Coloring & Highlight", dan tiga kategori berisi 1 item.
//   5. 18 paket tampil sebagai "Paket 1 Rp160.000" tanpa keterangan apa pun. Isi
//      persisnya cuma salon yang tahu, tapi harga normal tiap komponen ADA di kolom
//      Variant Name — jadi minimal jumlah layanan dan nilai hematnya bisa ditulis.
//
// Jalankan: node scripts/rapikan-csv.js
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SUMBER = path.join(root, 'csv/service.csv');
const HASIL = path.join(root, 'csv/harga-rapi.csv');

// ── Keputusan penyuntingan, ditulis eksplisit supaya gampang ditinjau ──

// Baris duplikat yang dibuang. Pasangannya (yang dipertahankan) punya harga coret
// + promo, jadi pelanggan tetap lihat harga promo yang sama persis.
const BUANG = new Set([
  'PROMO Nail Gell Polos',   // = Nail jell polos  Rp110.000 → Rp60.000
  'PROMO Nail Art Simple',   // = NailArt Simple   Rp170.000 → Rp120.000
  'PROMO Nail Art Premium',  // = NailArt Premium  Rp200.000 → Rp140.000
  'PROMO Nail Art Cat Eye',  // = Nail Cat Eye     Rp150.000 → Rp90.000
  'PROMO Ratus Mis-V',       // = Ratus Vagina     Rp50.000  → Rp30.000
]);

// Ganti nama. "Ratus Vagina" terpampang di halaman publik dan ikut tertanam di
// schema.org, jadi bisa muncul di hasil pencarian — istilah salonnya sendiri
// ("Ratus Mis-V", dipakai di baris kembarannya) jauh lebih pas.
const GANTI_NAMA = {
  'Ratus Vagina': 'Ratus Mis-V',
  'Totok Wajah 30menit': 'Totok Wajah', // durasinya pindah ke kolom Duration
};

// Durasi bawaan POS yang mustahil benar → dikosongkan sampai diisi salon.
// Yang tidak masuk daftar ini memang wajar 5 menit (pakai shampo, shower cap,
// pasang kepang, kuku palsu, remover, cut bangs).
const DURASI_KOSONGKAN = new Set([
  'Colouring', 'Smoothing Short', 'Cutting styling', 'Gunting Rapi', 'Scrub Scalp',
  'Lepas Ext 80helai', 'Service Ext 142 Helai', 'Rambut Ext Premium 25Helai*9',
  'Pasang Ext 110 Helai*3', 'Ratus Vagina',
]);

// Durasi yang bisa dipastikan dari nama layanan itu sendiri.
const DURASI_PERBAIKI = { 'Totok Wajah 30menit': '30min' };

// Kategori tampil. Yang tidak disebut di sini ikut kategori asli dari POS.
const KATEGORI = {
  // Perawatan badan & wajah — sebelumnya nyasar di "Hair Spa & Treatment",
  // plus tiga kategori yang isinya cuma 1 item (Facial, Lulur, Whitening).
  'Massage Body 60 Menit': 'Perawatan Badan & Wajah',
  'Body Scrub 40 Menit': 'Perawatan Badan & Wajah',
  'Mandi Susu Oles': 'Perawatan Badan & Wajah',
  'Bleaching Badan': 'Perawatan Badan & Wajah',
  'Facial Treatment': 'Perawatan Badan & Wajah',
  'Totok Wajah 30menit': 'Perawatan Badan & Wajah',
  'Ratus Vagina': 'Perawatan Badan & Wajah',
  // Pemasangan & perawatan extension — sebelumnya berserakan di "Coloring &
  // Highlight" dan "Lainnya".
  'Pasang Ext Kepang 2*3': 'Hair Extension',
  'Pasang ext 2*2': 'Hair Extension',
  'Lepas Ext 80helai': 'Hair Extension',
  'Service Ext 142 Helai': 'Hair Extension',
  'Rambut Ext Premium 25Helai*9': 'Hair Extension',
  'Pasang Ext 110 Helai*3': 'Hair Extension',
};

// Paket dinomori acak di export (…4, 6, 7, 5, 8…). Urutkan angka dulu, baru huruf.
const urutPaket = (nama) => {
  const m = /^Paket\s+(\d+|[A-Z])$/i.exec(nama.trim());
  if (!m) return [9, 0, nama];
  return /^\d+$/.test(m[1]) ? [0, +m[1], ''] : [1, 0, m[1].toUpperCase()];
};

// ── Baca & tulis CSV ──

function parseCsv(text) {
  const baris = [];
  let cur = [], nilai = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { nilai += '"'; i++; } else q = false; }
      else nilai += c;
    } else if (c === '"') q = true;
    else if (c === ',') { cur.push(nilai); nilai = ''; }
    else if (c === '\n') { cur.push(nilai); baris.push(cur); cur = []; nilai = ''; }
    else if (c !== '\r') nilai += c;
  }
  if (nilai || cur.length) { cur.push(nilai); baris.push(cur); }
  return baris.filter(r => r.some(v => v.trim()));
}

const sel = (s) => '"' + String(s ?? '').replace(/"/g, '""') + '"';
const rupiah = (n) => n.toLocaleString('id-ID') + ',00';
const angka = (s) => parseInt(String(s || '').split(',')[0].replace(/[^\d]/g, ''), 10) || 0;
const bersih = (s) => String(s || '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const baris = parseCsv(readFileSync(SUMBER, 'utf8'));
const kolom = baris[0].map(h => h.replace(/\s+/g, ' ').trim());
const idx = (nama) => kolom.indexOf(nama);
const iType = idx('Type'), iTreat = idx('Treatment Name'), iGroup = idx('Group Name'),
      iItem = idx('Item Name'), iVar = idx('Variant Name'), iRetail = idx('Retail Price'),
      iSpecial = idx('Special Price'), iDur = idx('Duration');

const hasil = [];
let dibuang = 0, durasiDikosongkan = 0, kategoriDipindah = 0, paketDijelaskan = 0;

for (const f of baris.slice(1)) {
  const asli = bersih(f[iItem]);
  if (!asli) continue;
  if (BUANG.has(asli)) { dibuang++; continue; }

  const harga = angka(f[iRetail]);
  if (harga <= 0) continue;
  const paket = f[iType] === 'Package';

  // Kategori: pakai peta di atas, kalau tidak ada ikut aturan lama (Treatment
  // Name, jatuh ke Group Name kalau kosong/"Other").
  let kategori = KATEGORI[asli];
  if (kategori) kategoriDipindah++;
  else {
    kategori = bersih(f[iTreat]);
    if (!kategori || kategori === 'Other') kategori = bersih(f[iGroup]);
    if (paket) kategori = 'Paket Layanan';
    else if (!kategori || kategori === 'Paket Layanan') kategori = 'Lainnya';
    if (kategori === 'Coloring') kategori = 'Coloring & Highlight';
  }

  let durasi = bersih(f[iDur]);
  if (DURASI_PERBAIKI[asli]) durasi = DURASI_PERBAIKI[asli];
  else if (DURASI_KOSONGKAN.has(asli)) { durasi = ''; durasiDikosongkan++; }

  // Keterangan paket dari harga normal tiap komponen di kolom Variant Name.
  // Nama komponennya tidak ikut ter-export, jadi yang ditulis hanya yang pasti:
  // berapa layanan dan berapa hematnya dibanding ambil satu-satu.
  let keterangan = '';
  if (paket) {
    const normal = [...String(f[iVar] || '').matchAll(/Origin Price ([\d.]+),/g)]
      .map(m => parseInt(m[1].replace(/\./g, ''), 10));
    if (normal.length) {
      const total = normal.reduce((a, b) => a + b, 0);
      const hemat = total - harga;
      keterangan = `${normal.length} layanan` +
        (hemat > 0 ? `, normal Rp${total.toLocaleString('id-ID')} — hemat Rp${hemat.toLocaleString('id-ID')}` : '');
      paketDijelaskan++;
    }
  }

  hasil.push({
    type: f[iType], kategori, nama: GANTI_NAMA[asli] || asli, keterangan,
    harga, promo: angka(f[iSpecial]), durasi, paket,
  });
}

hasil.sort((a, b) => {
  if (a.paket !== b.paket) return a.paket ? 1 : -1;   // paket di bawah
  if (!a.paket) return 0;                              // sisanya: urutan asli
  const [ax, ay, az] = urutPaket(a.nama), [bx, by, bz] = urutPaket(b.nama);
  return ax - bx || ay - by || az.localeCompare(bz);
});

const HEADER = ['Type', 'Treatment Name', 'Group Name', 'Item Name', 'Description',
                'Retail Price', 'Special Price', 'Duration'];
const keluar = [HEADER.map(sel).join(',')];
for (const r of hasil) {
  keluar.push([r.type, r.kategori, r.kategori, r.nama, r.keterangan,
               rupiah(r.harga), rupiah(r.promo), r.durasi].map(sel).join(','));
}
writeFileSync(HASIL, keluar.join('\n') + '\n');

console.log(`[rapikan-csv] ${baris.length - 1} baris masuk → ${hasil.length} baris keluar`);
console.log(`  duplikat dibuang     : ${dibuang}`);
console.log(`  kategori dipindah    : ${kategoriDipindah}`);
console.log(`  durasi palsu dihapus : ${durasiDikosongkan}`);
console.log(`  paket dapat keterangan: ${paketDijelaskan}`);
console.log(`  → ${path.relative(root, HASIL)}`);
