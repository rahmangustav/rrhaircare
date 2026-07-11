import { getSettings, verifyPassword, signToken, loginRateStatus, noteLogin, json } from '../lib/data.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);

  const ip = (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown';

  const rate = await loginRateStatus(ip);
  if (rate.blocked) {
    const menit = Math.max(1, Math.ceil(rate.retryAfter / 60));
    return json({ error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${menit} menit.` }, 429);
  }

  const { password } = await req.json().catch(() => ({}));
  const s = await getSettings();
  if (verifyPassword(password || '', s.adminPassword)) {
    await noteLogin(ip, true);
    return json({ token: signToken(s.authSecret) });
  }
  await noteLogin(ip, false);
  return json({ error: 'Password salah' }, 401);
};

export const config = { path: '/api/admin/login' };
