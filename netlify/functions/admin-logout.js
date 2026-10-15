import { requireAuth, revokeToken, json } from '../lib/data.js';

// Cabut token admin yang sedang dipakai (server-side) saat klik "Keluar" —
// tanpa ini token stateless tetap sah sampai exp 12 jam walau sudah "logout".
export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  await revokeToken(token);
  return json({ ok: true });
};

export const config = { path: '/api/admin/logout' };
