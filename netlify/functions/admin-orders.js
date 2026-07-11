import { requireAuth, getOrders, updateOrder, expireStaleOrders, ORDER_STATUSES, json } from '../lib/data.js';

export default async (req, context) => {
  if (!(await requireAuth(req))) return json({ error: 'Perlu login admin' }, 401);

  if (req.method === 'GET') return json(await expireStaleOrders());

  if (req.method === 'PUT') {
    const b = await req.json().catch(() => ({}));
    if (!ORDER_STATUSES.includes(b.status)) return json({ error: 'Status tidak valid' }, 400);
    const o = await updateOrder(context.params.id, { status: b.status });
    if (!o) return json({ error: 'Pesanan tidak ada' }, 404);
    return json(o);
  }
  return json({ error: 'Method tidak didukung' }, 405);
};

export const config = { path: ['/api/admin/orders', '/api/admin/orders/:id'] };
