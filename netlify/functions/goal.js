import { recordGoal, analyticsRateStatus, noteAnalyticsHit, json } from '../lib/data.js';

// Pencatat sasaran konversi (klik booking WhatsApp dll). Publik, tanpa auth,
// sama seperti /api/hit — tak ada data pribadi yang disimpan.
export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const ip = (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  // Berbagi jendela batas yang sama dengan /api/hit — sama-sama beacon
  // fire-and-forget yang menulis ke blob analytics bersama.
  if ((await analyticsRateStatus(ip)).blocked) return json({ ok: false });
  const b = await req.json().catch(() => ({}));

  let selfHost = '';
  try { selfHost = new URL(req.url).hostname.toLowerCase().replace(/^www\./, ''); } catch {}

  const g = await recordGoal({
    name: (b.name || '').toString().slice(0, 30),
    spot: (b.spot || '').toString().slice(0, 20),
    ref: (b.ref || '').toString().slice(0, 300),
    campaign: (b.campaign || '').toString().slice(0, 40),
    selfHost,
  });
  await noteAnalyticsHit(ip);
  // Nama sasaran tak dikenal → diabaikan diam-diam, jangan bikin data sampah.
  return json({ ok: Boolean(g) });
};

export const config = { path: '/api/goal' };
