import { recordHit, json } from '../lib/data.js';

// Pencatat kunjungan publik. Dipanggil oleh beacon kecil di halaman toko.
// Keunikan pengunjung ditentukan server dari IP (klien tak bisa memalsukan).
export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const b = await req.json().catch(() => ({}));
  const ip = (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  await recordHit({ path: b.path, ip });
  return json({ ok: true });
};

export const config = { path: '/api/hit' };
