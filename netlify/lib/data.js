// Lapisan data untuk toko (Netlify Blobs) + auth + media.
// Semua data disimpan di Netlify Blobs — tanpa server/DB eksternal.
import { getStore } from '@netlify/blobs';
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

const shop = () => getStore({ name: 'shop', consistency: 'strong' });
const media = () => getStore({ name: 'media', consistency: 'strong' });

async function readJSON(key, fallback) {
  const v = await shop().get(key, { type: 'json' });
  return v == null ? fallback : v;
}
const writeJSON = (key, val) => shop().setJSON(key, val);

// ── Password (scrypt) ──
export function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(pw, salt, 64).toString('hex');
}
export function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = scryptSync(pw, salt, 64);
  const target = Buffer.from(hash, 'hex');
  return test.length === target.length && timingSafeEqual(test, target);
}

// ── Token admin (HMAC, stateless) ──
function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
export function signToken(secret, hours = 12) {
  const payload = b64url(JSON.stringify({ exp: Date.now() + hours * 3600e3 }));
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + sig;
}
export function verifyToken(token, secret) {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  const expect = createHmac('sha256', secret).update(payload).digest('base64url');
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString()).exp > Date.now(); }
  catch { return false; }
}

// ── Pengaturan (dibuat otomatis pertama kali) ──
export async function getSettings() {
  let s = await readJSON('settings', null);
  if (!s) {
    s = {
      storeName: 'RR Hair Care',
      whatsapp: '6281234567890',
      qrisImage: '',
      bankInfo: 'BCA 1234567890 a.n. Rahman Gustav',
      shippingOptions: [
        { id: 'jabodetabek', label: 'Jabodetabek', price: 15000 },
        { id: 'jawa', label: 'Pulau Jawa (luar Jabodetabek)', price: 25000 },
        { id: 'luarjawa', label: 'Luar Pulau Jawa', price: 40000 },
        { id: 'ambil', label: 'Ambil di salon (Koja) — gratis', price: 0 }
      ],
      adminPassword: hashPassword('admin123'),
      authSecret: randomBytes(32).toString('hex')
    };
    await writeJSON('settings', s);
  }
  return s;
}
export async function saveSettings(patch) {
  const s = { ...(await getSettings()), ...patch };
  await writeJSON('settings', s);
  return s;
}

// ── Produk ──
export const getProducts = () => readJSON('products', []);
export const saveProducts = (list) => writeJSON('products', list);
export async function addProduct(p) {
  const list = await getProducts();
  const item = { id: 'p_' + Date.now().toString(36) + randomBytes(2).toString('hex'),
    name: p.name, category: p.category || 'Produk',
    price: Number(p.price) || 0, stock: Number(p.stock) || 0,
    description: p.description || '', image: p.image || '',
    active: p.active !== false, createdAt: Date.now() };
  list.unshift(item); await saveProducts(list); return item;
}
export async function updateProduct(id, patch) {
  const list = await getProducts();
  const i = list.findIndex(p => p.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch,
    price: patch.price !== undefined ? Number(patch.price) : list[i].price,
    stock: patch.stock !== undefined ? Number(patch.stock) : list[i].stock };
  await saveProducts(list); return list[i];
}
export async function deleteProduct(id) {
  await saveProducts((await getProducts()).filter(p => p.id !== id));
}

// ── Pesanan ──
export const getOrders = () => readJSON('orders', []);
export async function addOrder(o) {
  const list = await getOrders();
  const code = 'RR' + new Date().toISOString().slice(2, 10).replace(/-/g, '') +
    '-' + randomBytes(2).toString('hex').toUpperCase();
  const order = { id: 'o_' + Date.now().toString(36), code, ...o,
    status: 'menunggu_pembayaran', createdAt: Date.now() };
  list.unshift(order); await writeJSON('orders', list); return order;
}
export async function updateOrder(id, patch) {
  const list = await getOrders();
  const i = list.findIndex(o => o.id === id);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  await writeJSON('orders', list); return list[i];
}
export async function updateOrderByCode(code, patch) {
  const list = await getOrders();
  const i = list.findIndex(o => o.code === code);
  if (i < 0) return null;
  list[i] = { ...list[i], ...patch };
  await writeJSON('orders', list); return list[i];
}

// ── Media (foto) — disimpan sebagai blob biner ──
// Terima data URL base64 (mis. "data:image/jpeg;base64,...."), simpan, balikin URL /api/media/<key>.
export async function saveMedia(dataUrl) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return '';
  const contentType = m[1];
  const buf = Buffer.from(m[2], 'base64');
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg').replace('+xml', '');
  const key = Date.now().toString(36) + randomBytes(3).toString('hex') + '.' + ext;
  await media().set(key, buf, { metadata: { contentType } });
  return '/api/media/' + key;
}
export async function getMedia(key) {
  const res = await media().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) return null;
  return { data: Buffer.from(res.data), contentType: (res.metadata && res.metadata.contentType) || 'image/jpeg' };
}

// ── Helper HTTP ──
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function requireAuth(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const s = await getSettings();
  return verifyToken(token, s.authSecret) ? s : null;
}
