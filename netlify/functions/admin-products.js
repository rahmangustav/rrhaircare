import { requireAuth, getProducts, addProduct, updateProduct, deleteProduct, saveMedia, buildProductFields, json } from '../lib/data.js';

export default async (req, context) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);
  const id = context.params.id;

  if (req.method === 'GET') return json(await getProducts());

  if (req.method === 'DELETE') {
    await deleteProduct(id);
    return json({ ok: true });
  }

  if (req.method === 'POST' || req.method === 'PUT') {
    const b = await req.json().catch(() => ({}));
    const fields = buildProductFields(b);
    if (b.imageData) {
      try { fields.image = await saveMedia(b.imageData); }
      catch (e) { return json({ error: 'Ukuran gambar terlalu besar (maks 4 MB)' }, 413); }
    }

    if (req.method === 'POST') {
      if (!fields.name) return json({ error: 'Nama produk wajib diisi' }, 400);
      return json(await addProduct(fields));
    }
    // PUT: hapus field yang undefined agar tidak menimpa
    Object.keys(fields).forEach(k => fields[k] === undefined && delete fields[k]);
    const item = await updateProduct(id, fields);
    if (!item) return json({ error: 'Produk tidak ada' }, 404);
    return json(item);
  }
  return json({ error: 'Method tidak didukung' }, 405);
};

export const config = { path: ['/api/admin/products', '/api/admin/products/:id'] };
