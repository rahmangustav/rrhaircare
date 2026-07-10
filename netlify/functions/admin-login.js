import { getSettings, verifyPassword, signToken, json } from '../lib/data.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const { password } = await req.json().catch(() => ({}));
  const s = await getSettings();
  if (verifyPassword(password || '', s.adminPassword))
    return json({ token: signToken(s.authSecret) });
  return json({ error: 'Password salah' }, 401);
};

export const config = { path: '/api/admin/login' };
