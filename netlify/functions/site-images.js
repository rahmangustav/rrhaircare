import { getSiteImages, json } from '../lib/data.js';

// Foto tetap per bagian halaman (publik), mis. { about: '/api/media/xxx.jpg' }.
export default async () => json(await getSiteImages());

export const config = { path: '/api/site-images' };
