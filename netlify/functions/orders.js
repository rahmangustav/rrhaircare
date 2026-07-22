import { getProducts, getSettings, addOrder, expireStaleOrders,
  orderRateStatus, noteOrderCreated, reserveStockFor, resolveShipping, json } from '../lib/data.js';

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'Method tidak didukung' }, 405);

  const ip = (context && context.ip) ||
    req.headers.get('x-nf-client-connection-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    '';
  const rate = await orderRateStatus(ip);
  if (rate.blocked) {
    const menit = Math.max(1, Math.ceil(rate.retryAfter / 60));
    return json({ error: `Terlalu banyak pesanan dari perangkat ini. Coba lagi dalam ${menit} menit.` }, 429);
  }

  const { items, customer, shippingId } = await req.json().catch(() => ({}));
  if (!Array.isArray(items) || !items.length) return json({ error: 'Keranjang kosong' }, 400);
  if (!customer || !customer.name || !customer.phone || !customer.address)
    return json({ error: 'Data pengiriman belum lengkap' }, 400);

  // Bebaskan dulu stok dari order telat bayar sebelum cek ketersediaan.
  await expireStaleOrders();
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
  const ship = resolveShipping(settings.shippingOptions, shippingId);
  if (!ship) return json({ error: 'Opsi pengiriman tidak valid' }, 400);

  // Pengecekan stok di atas cuma gagal-cepat (UX) dari snapshot awal `products`.
  // Otoritas sebenarnya ada di reserveStockFor, yang membaca ulang stok TERKINI
  // dan mengurangi di sana — supaya dua order yang datang nyaris bersamaan untuk
  // unit terakhir sebuah produk tidak sama-sama lolos dan stok jadi minus.
  const short = await reserveStockFor(orderItems);
  if (short.length) {
    return json({ error: 'Maaf, stok baru saja habis untuk salah satu produk. Coba pesan ulang.' }, 409);
  }

  const order = await addOrder({
    items: orderItems, subtotal, shipping: { label: ship.label, price: ship.price },
    total: subtotal + ship.price,
    customer: { name: customer.name, phone: customer.phone, address: customer.address,
      city: customer.city || '', note: customer.note || '' },
    paymentProof: ''
  });
  await noteOrderCreated(ip);
  return json({ ok: true, code: order.code, id: order.id, total: order.total });
};

export const config = { path: '/api/orders' };
