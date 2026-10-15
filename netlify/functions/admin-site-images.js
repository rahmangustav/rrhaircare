import { requireAuth, getSiteImages, setSiteImage, deleteSiteImage, saveMedia, sanitizeSiteImageKey, json } from '../lib/data.js';

// Kelola foto tetap per bagian halaman dari admin (perlu login).
export default async (req, context) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);

  if (req.method === 'GET') return json(await getSiteImages());

  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    const key = sanitizeSiteImageKey(b.key);
    if (!key) return json({ error: 'Slot foto wajib diisi' }, 400);
    let image = b.image || '';
    if (b.imageData) {
      try { image = await saveMedia(b.imageData); }
      catch (e) { return json({ error: 'Ukuran gambar terlalu besar (maks 4 MB)' }, 413); }
    }
    if (!image) return json({ error: 'Foto wajib diunggah' }, 400);
    return json(await setSiteImage(key, image));
  }

  if (req.method === 'DELETE') {
    return json(await deleteSiteImage(context.params.key));
  }
  return json({ error: 'Method tidak didukung' }, 405);
};

export const config = { path: ['/api/admin/site-images', '/api/admin/site-images/:key'] };
