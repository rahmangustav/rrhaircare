import { requireAuth, saveSettings, json } from '../lib/data.js';
import { randomBytes } from 'node:crypto';

export default async (req) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);

  // Token admin bersifat stateless (HMAC + exp), jadi satu-satunya cara mencabutnya
  // sebelum kedaluwarsa adalah mengganti authSecret — token lama (termasuk yang
  // mungkin bocor) langsung tidak valid lagi begitu secret berubah.
  await saveSettings({ authSecret: randomBytes(32).toString('hex') });
  return json({ ok: true });
};

export const config = { path: '/api/admin/logout' };
