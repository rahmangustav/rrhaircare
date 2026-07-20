import { getOrders, updateOrderByCode, saveMedia, PROOF_UPLOADABLE_STATUSES, json } from '../lib/data.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const code = context.params.code;
  const existing = (await getOrders()).find(o => o.code === code);
  if (!existing) return json({ error: 'Pesanan tidak ditemukan' }, 404);
  if (!PROOF_UPLOADABLE_STATUSES.includes(existing.status)) {
    return json({ error: 'Pesanan ini sudah diproses, tidak bisa unggah bukti bayar lagi' }, 400);
  }
  const { proof } = await req.json().catch(() => ({}));
  let url;
  try { url = await saveMedia(proof); }
  catch (e) { return json({ error: 'Ukuran gambar terlalu besar (maks 4 MB)' }, 413); }
  if (!url) return json({ error: 'File bukti tidak valid' }, 400);
  const o = await updateOrderByCode(code, { paymentProof: url, status: 'menunggu_verifikasi' });
  if (!o) return json({ error: 'Pesanan tidak ditemukan' }, 404);
  return json({ ok: true });
};

export const config = { path: '/api/orders/:code/proof' };
