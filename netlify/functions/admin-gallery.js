import { requireAuth, getGallery, addGalleryPhoto, deleteGalleryPhoto, saveMedia, json } from '../lib/data.js';

// Kelola foto galeri dari panel admin (perlu login).
export default async (req, context) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);

  if (req.method === 'GET') return json(await getGallery());

  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    let image = b.image || '';
    if (b.imageData) {
      try { image = await saveMedia(b.imageData); }
      catch (e) { return json({ error: 'Ukuran gambar terlalu besar (maks 4 MB)' }, 413); }
    }
    if (!image) return json({ error: 'Foto wajib diunggah' }, 400);
    return json(await addGalleryPhoto({ image, caption: b.caption }));
  }

  if (req.method === 'DELETE') {
    await deleteGalleryPhoto(context.params.id);
    return json({ ok: true });
  }
  return json({ error: 'Method tidak didukung' }, 405);
};

export const config = { path: ['/api/admin/gallery', '/api/admin/gallery/:id'] };
