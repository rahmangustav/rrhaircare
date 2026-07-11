import { getGallery, json } from '../lib/data.js';

// Daftar foto galeri untuk ditampilkan di landing (publik).
export default async () => json(await getGallery());

export const config = { path: '/api/gallery' };
