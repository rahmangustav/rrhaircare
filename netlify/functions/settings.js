import { getSettings, json } from '../lib/data.js';

export default async () => {
  const s = await getSettings();
  return json({ storeName: s.storeName, whatsapp: s.whatsapp, qrisImage: s.qrisImage,
    bankInfo: s.bankInfo, shippingOptions: s.shippingOptions });
};

export const config = { path: '/api/settings' };
