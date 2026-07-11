import { recordHit, json } from '../lib/data.js';

// Pencatat kunjungan publik. Dipanggil oleh beacon kecil di halaman toko.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const b = await req.json().catch(() => ({}));
  await recordHit({ path: b.path, unique: b.unique === true });
  return json({ ok: true });
};

export const config = { path: '/api/hit' };
