// Harga resmi dari ~/RRHairCare/post/harga.json (disalin oleh scripts/sinkron-harga.py).
// Dipakai /api/pricelist dan scripts/prerender.js supaya harga di website = harga di DM, IG, dan kasir.
// Hanya layanan yang namanya sama persis yang ditimpa; sisanya (mis. nail art) tetap dari panel admin.
// Import JSON (bukan readFileSync) supaya ikut terbundel esbuild di Netlify Functions.
import RESMI from './harga-resmi.json' with { type: 'json' };

// Isian durasi bawaan POS ("5min") dibuang, kecuali untuk tambahan kecil (Pakai …, Shower Cap) yang memang singkat.
const BAWAAN_POS = /^5\s*min$/i;
const TAMBAHAN = /^(pakai\s|shower cap)/i;

export function terapkanHargaResmi(list, resmi = RESMI) {
  if (!Array.isArray(list)) return list;
  const harga = resmi.harga || {};
  const ket = resmi.keterangan || {};
  const durasi = resmi.durasi || {};
  const ada = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  return list.map((p) => {
    if (!p) return p;
    let q = p;
    if (ada(durasi, p.name)) q = { ...q, duration: durasi[p.name] };
    else if (BAWAAN_POS.test(p.duration || '') && !TAMBAHAN.test(p.name || '')) q = { ...q, duration: '' };
    if (!ada(harga, p.name)) return q;
    q = { ...q, price: Number(harga[p.name]) };
    if (q.promo && q.promo >= q.price) q.promo = 0;
    if (ket[p.name] && !p.desc) q.desc = ket[p.name];
    return q;
  });
}
