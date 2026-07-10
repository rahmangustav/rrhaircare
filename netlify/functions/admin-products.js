import { requireAuth, getProducts, addProduct, updateProduct, deleteProduct, saveMedia, json } from '../lib/data.js';

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
    const fields = { name: b.name, category: b.category, price: b.price, stock: b.stock,
      description: b.description, active: b.active !== false && b.active !== 'false' };
    if (b.imageData) fields.image = await saveMedia(b.imageData);

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
