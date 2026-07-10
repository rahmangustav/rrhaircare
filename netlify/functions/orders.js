import { getProducts, saveProducts, getSettings, addOrder, json } from '../lib/data.js';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);
  const { items, customer, shippingId } = await req.json().catch(() => ({}));
  if (!Array.isArray(items) || !items.length) return json({ error: 'Keranjang kosong' }, 400);
  if (!customer || !customer.name || !customer.phone || !customer.address)
    return json({ error: 'Data pengiriman belum lengkap' }, 400);

  const products = await getProducts();
  const settings = await getSettings();
  let subtotal = 0;
  const orderItems = [];
  for (const it of items) {
    const p = products.find(x => x.id === it.id);
    if (!p) return json({ error: 'Produk tidak ditemukan' }, 400);
    const qty = Math.max(1, Number(it.qty) || 1);
    if (p.stock < qty) return json({ error: `Stok "${p.name}" tidak cukup (sisa ${p.stock})` }, 400);
    subtotal += p.price * qty;
    orderItems.push({ id: p.id, name: p.name, price: p.price, qty });
  }
  const ship = (settings.shippingOptions || []).find(s => s.id === shippingId) || { label: '-', price: 0 };
  const order = await addOrder({
    items: orderItems, subtotal, shipping: { label: ship.label, price: ship.price },
    total: subtotal + ship.price,
    customer: { name: customer.name, phone: customer.phone, address: customer.address,
      city: customer.city || '', note: customer.note || '' },
    paymentProof: ''
  });
  // Kurangi stok
  for (const it of orderItems) {
    const p = products.find(x => x.id === it.id);
    if (p) p.stock -= it.qty;
  }
  await saveProducts(products);
  return json({ ok: true, code: order.code, id: order.id, total: order.total });
};

export const config = { path: '/api/orders' };
