import { getPricelist, json } from '../lib/data.js';

// Daftar harga untuk ditampilkan di landing (publik).
export default async () => json(await getPricelist());

export const config = { path: '/api/pricelist' };
