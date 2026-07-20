import { getOrders, updateOrderByCode, saveMedia, PROOF_UPLOADABLE_STATUSES,
  proofRateStatus, noteProofUploaded, json } from '../lib/data.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);

  const ip = (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  const rate = await proofRateStatus(ip);
  if (rate.blocked) {
    const menit = Math.max(1, Math.ceil(rate.retryAfter / 60));
    return json({ error: `Terlalu banyak unggahan dari perangkat ini. Coba lagi dalam ${menit} menit.` }, 429);
  }

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
  // Catat sebelum cocokkan kode order — blob sudah tertulis di titik ini,
  // jadi upaya menebak kode tetap ikut kena batas, bukan cuma yang berhasil.
  await noteProofUploaded(ip);
  const o = await updateOrderByCode(code, { paymentProof: url, status: 'menunggu_verifikasi' });
  if (!o) return json({ error: 'Pesanan tidak ditemukan' }, 404);
  return json({ ok: true });
};

export const config = { path: '/api/orders/:code/proof' };
