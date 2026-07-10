import { updateOrderByCode, saveMedia, json } from '../lib/data.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const { proof } = await req.json().catch(() => ({}));
  const url = await saveMedia(proof);
  if (!url) return json({ error: 'File bukti tidak valid' }, 400);
  const o = await updateOrderByCode(context.params.code, { paymentProof: url, status: 'menunggu_verifikasi' });
  if (!o) return json({ error: 'Pesanan tidak ditemukan' }, 404);
  return json({ ok: true });
};

export const config = { path: '/api/orders/:code/proof' };
