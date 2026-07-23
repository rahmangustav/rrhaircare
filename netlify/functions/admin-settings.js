import { requireAuth, getSettings, saveSettings, saveMedia, hashPassword, deleteMediaByUrl,
  sanitizeShippingOptions, json } from '../lib/data.js';

export default async (req) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);

  if (req.method === 'GET') {
    const { adminPassword, authSecret, ...rest } = await getSettings();
    return json(rest);
  }

  if (req.method === 'PUT') {
    const b = await req.json().catch(() => ({}));
    const patch = {};
    if (b.storeName !== undefined) patch.storeName = b.storeName;
    if (b.whatsapp !== undefined) patch.whatsapp = b.whatsapp;
    if (b.bankInfo !== undefined) patch.bankInfo = b.bankInfo;
    if (Array.isArray(b.shippingOptions)) patch.shippingOptions = sanitizeShippingOptions(b.shippingOptions);
    let oldQris = '';
    if (b.qrisData) {
      oldQris = (await getSettings()).qrisImage;
      try { patch.qrisImage = await saveMedia(b.qrisData); }
      catch (e) { return json({ error: 'Ukuran gambar terlalu besar (maks 4 MB)' }, 413); }
    }
    if (b.newPassword) patch.adminPassword = hashPassword(b.newPassword);
    const { adminPassword, authSecret, ...rest } = await saveSettings(patch);
    if (oldQris && oldQris !== patch.qrisImage) await deleteMediaByUrl(oldQris);
    return json({ ok: true, settings: rest });
  }
  return json({ error: 'Method tidak didukung' }, 405);
};

export const config = { path: '/api/admin/settings' };
