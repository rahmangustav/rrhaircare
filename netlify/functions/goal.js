import { recordGoal, json } from '../lib/data.js';

// Pencatat sasaran konversi (klik booking WhatsApp dll). Publik, tanpa auth,
// sama seperti /api/hit — tak ada data pribadi yang disimpan.
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
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
  // Nama sasaran tak dikenal → diabaikan diam-diam, jangan bikin data sampah.
  return json({ ok: Boolean(g) });
};

export const config = { path: '/api/goal' };
