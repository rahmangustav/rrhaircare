import { recordHit, analyticsRateStatus, noteAnalyticsHit, json } from '../lib/data.js';

// Pencatat kunjungan publik. Dipanggil oleh beacon kecil di halaman toko.
// Keunikan pengunjung ditentukan server dari IP (klien tak bisa memalsukan).
export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const ip = (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  // Beacon fire-and-forget (lihat public/js/hit.js) — klien mengabaikan hasil,
  // jadi cukup diam-diam tak dicatat kalau kena batas, tanpa perlu 429.
  if ((await analyticsRateStatus(ip)).blocked) return json({ ok: false });
  const b = await req.json().catch(() => ({}));
  let selfHost = '';
  try { selfHost = new URL(req.url).hostname.toLowerCase().replace(/^www\./, ''); } catch {}
  await recordHit({
    path: b.path,
    ip,
    ref: (b.ref || '').toString().slice(0, 300),
    campaign: (b.campaign || '').toString().slice(0, 40),
    selfHost,
  });
  await noteAnalyticsHit(ip);
  return json({ ok: true });
};

export const config = { path: '/api/hit' };
