import { requireAuth, getStats, json } from '../lib/data.js';

// Statistik pengunjung untuk panel admin (perlu login).
export default async (req) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);
  return json(await getStats());
};

export const config = { path: '/api/admin/stats' };
