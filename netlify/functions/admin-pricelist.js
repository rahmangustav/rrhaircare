import { requireAuth, getPricelist, addPriceItem, updatePriceItem, deletePriceItem, importPricelistCsv, json } from '../lib/data.js';

// Kelola daftar harga dari admin (perlu login).
export default async (req, context) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);
  const id = context.params.id;

  if (req.method === 'GET') return json(await getPricelist());

  if (req.method === 'POST') {
    const b = await req.json().catch(() => ({}));
    // Kalau ada field csv → import (ganti semua). Kalau tidak → tambah 1 item.
    if (typeof b.csv === 'string' && b.csv.trim()) {
      try {
        const list = await importPricelistCsv(b.csv);
        return json({ imported: list.length, list });
      } catch (e) {
        if (e.code === 'CSV_EMPTY') {
          return json({ error: 'Format CSV tidak dikenali atau tidak ada baris valid — daftar harga TIDAK diubah' }, 400);
        }
        throw e;
      }
    }
    if (!b.name) return json({ error: 'Nama layanan wajib diisi' }, 400);
    return json(await addPriceItem(b));
  }

  if (req.method === 'PUT') {
    const b = await req.json().catch(() => ({}));
    const item = await updatePriceItem(id, b);
    if (!item) return json({ error: 'Item tidak ada' }, 404);
    return json(item);
  }

  if (req.method === 'DELETE') {
    await deletePriceItem(id);
    return json({ ok: true });
  }
  return json({ error: 'Method tidak didukung' }, 405);
};

export const config = { path: ['/api/admin/pricelist', '/api/admin/pricelist/:id'] };
