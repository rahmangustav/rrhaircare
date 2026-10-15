import { getPricelist, json } from '../lib/data.js';
import { terapkanHargaResmi } from '../lib/harga-resmi.js';

// Daftar harga untuk ditampilkan di landing (publik). Harga layanan yang ada di harga.json resmi menimpa isi admin (16 Okt 2026).
export default async () => json(terapkanHargaResmi(await getPricelist()));

export const config = { path: '/api/pricelist' };
