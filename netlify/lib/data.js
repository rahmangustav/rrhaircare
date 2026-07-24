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

// ── Pembatas percobaan login (anti brute-force, per IP via Blobs) ──
const LOGIN_MAX_FAILS = 5;            // gagal berturut sebelum dikunci
const LOGIN_WINDOW_MS = 15 * 60e3;    // jendela penghitungan kegagalan
const LOGIN_LOCK_MS = 15 * 60e3;      // lama kunci setelah batas tercapai

// Logika murni (tanpa Blobs) — dipisah supaya bisa dites langsung, mengikuti
// pola computeProofRateStatus/computeOrderRateStatus di atas.
export function computeLoginRateStatus(rec, now) {
  if (rec && rec.lockedUntil && rec.lockedUntil > now)
    return { blocked: true, retryAfter: Math.ceil((rec.lockedUntil - now) / 1000) };
  return { blocked: false, retryAfter: 0 };
}
// ok=true (login sukses) -> null berarti rekam jejak IP ini dihapus.
export function nextLoginRateRecord(rec, now, ok) {
  if (ok) return null;
  const base = (rec && now - (rec.firstAt || 0) <= LOGIN_WINDOW_MS)
    ? { count: rec.count, firstAt: rec.firstAt } : { count: 0, firstAt: now };
  const r = { count: base.count + 1, firstAt: base.firstAt };
  if (r.count >= LOGIN_MAX_FAILS) r.lockedUntil = now + LOGIN_LOCK_MS;
  return r;
}

// Cek status kunci untuk sebuah IP; panggil sebelum verifikasi password.
export async function loginRateStatus(ip) {
  const all = await readJSON('loginAttempts', {});
  return computeLoginRateStatus(all[ip], Date.now());
}

// Catat hasil login: sukses membersihkan hitungan, gagal menaikkannya.
export async function noteLogin(ip, ok) {
  const all = await readJSON('loginAttempts', {});
  const now = Date.now();
  // Buang entri IP yang sudah tidak relevan agar blob tidak membengkak.
  for (const k of Object.keys(all)) {
    const r = all[k];
    const active = (r.lockedUntil && r.lockedUntil > now) ||
      (r.firstAt && now - r.firstAt < LOGIN_WINDOW_MS);
    if (!active) delete all[k];
  }
  const next = nextLoginRateRecord(all[ip], now, ok);
  if (next) all[ip] = next; else delete all[ip];
  await writeJSON('loginAttempts', all);
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
  const oldImage = list[i].image;
  list[i] = { ...list[i], ...patch,
    price: patch.price !== undefined ? Number(patch.price) : list[i].price,
    stock: patch.stock !== undefined ? Number(patch.stock) : list[i].stock };
  await saveProducts(list);
  if (patch.image !== undefined && oldImage && oldImage !== patch.image) await deleteMediaByUrl(oldImage);
  return list[i];
}
export async function deleteProduct(id) {
  const list = await getProducts();
  const item = list.find(p => p.id === id);
  await saveProducts(list.filter(p => p.id !== id));
  if (item && item.image) await deleteMediaByUrl(item.image);
}

// Bangun field yang akan diterapkan ke produk dari body request admin
// (dipakai untuk POST tambah & PUT edit). `active` HANYA disertakan kalau
// memang dikirim eksplisit oleh klien — kalau tidak, PUT edit produk (mis.
// cuma ubah harga/stok) akan diam-diam memaksa produk aktif lagi walau
// sebelumnya sengaja dinonaktifkan (toggle "Tampilkan di toko").
export function buildProductFields(b) {
  const fields = { name: b.name, category: b.category, price: b.price, stock: b.stock,
    description: b.description };
  if (b.active !== undefined) fields.active = b.active !== false && b.active !== 'false';
  return fields;
}

// ── Pesanan ──
// Stok dipotong saat order dibuat (menahan barang). Kalau order dibatalkan
// stok dikembalikan; order 'menunggu_pembayaran' yang lewat batas waktu
// dibatalkan otomatis supaya stok tidak terkunci selamanya.
export const ORDER_HOLD_MS = 24 * 3600e3; // 24 jam untuk bayar

// ── Pembatas order publik (anti borong-stok, per IP via Blobs) ──
// Order baru memotong stok SEBELUM bayar dan menahannya sampai ORDER_HOLD_MS.
// Tanpa batas ini, siapa pun bisa memborong seluruh stok berulang kali tanpa
// pernah membayar — pelanggan asli kehabisan barang yang sebenarnya ada.
const ORDER_MAX_PER_WINDOW = 5;     // maks order baru per IP dalam jendela
const ORDER_WINDOW_MS = 30 * 60e3;  // jendela 30 menit

// Logika murni (tanpa Blobs) — dipisah supaya bisa dites langsung.
export function computeOrderRateStatus(rec, now) {
  if (!rec || now - rec.firstAt > ORDER_WINDOW_MS) return { blocked: false, retryAfter: 0 };
  if (rec.count >= ORDER_MAX_PER_WINDOW)
    return { blocked: true, retryAfter: Math.ceil((rec.firstAt + ORDER_WINDOW_MS - now) / 1000) };
  return { blocked: false, retryAfter: 0 };
}
export function nextOrderRateRecord(rec, now) {
  const r = (rec && now - rec.firstAt <= ORDER_WINDOW_MS) ? rec : { count: 0, firstAt: now };
  return { count: r.count + 1, firstAt: r.firstAt };
}

export async function orderRateStatus(ip) {
  if (!ip) return { blocked: false, retryAfter: 0 };
  const all = await readJSON('orderAttempts', {});
  return computeOrderRateStatus(all[ip], Date.now());
}

export async function noteOrderCreated(ip) {
  if (!ip) return;
  const all = await readJSON('orderAttempts', {});
  const now = Date.now();
  for (const k of Object.keys(all)) {
    if (now - all[k].firstAt > ORDER_WINDOW_MS) delete all[k];
  }
  all[ip] = nextOrderRateRecord(all[ip], now);
  await writeJSON('orderAttempts', all);
}

// ── Pembatas unggah bukti bayar publik (anti banjir penyimpanan) ──
// /api/orders/:code/proof tak pernah butuh login — kode order cuma 4 hex
// acak (lihat catatan di order-proof.js). Tanpa batas ini siapa pun bisa
// memanggilnya berulang kali dengan gambar hingga 4 MB dan membanjiri
// Netlify Blobs dengan sampah biner, walau kodenya salah tebak sekalipun
// (saveMedia menulis blob duluan sebelum kode order dicocokkan).
const PROOF_MAX_PER_WINDOW = 8;     // maks unggahan per IP dalam jendela
const PROOF_WINDOW_MS = 60 * 60e3;  // jendela 60 menit

// Logika murni (tanpa Blobs) — dipisah supaya bisa dites langsung.
export function computeProofRateStatus(rec, now) {
  if (!rec || now - rec.firstAt > PROOF_WINDOW_MS) return { blocked: false, retryAfter: 0 };
  if (rec.count >= PROOF_MAX_PER_WINDOW)
    return { blocked: true, retryAfter: Math.ceil((rec.firstAt + PROOF_WINDOW_MS - now) / 1000) };
  return { blocked: false, retryAfter: 0 };
}
export function nextProofRateRecord(rec, now) {
  const r = (rec && now - rec.firstAt <= PROOF_WINDOW_MS) ? rec : { count: 0, firstAt: now };
  return { count: r.count + 1, firstAt: r.firstAt };
}

export async function proofRateStatus(ip) {
  if (!ip) return { blocked: false, retryAfter: 0 };
  const all = await readJSON('proofAttempts', {});
  return computeProofRateStatus(all[ip], Date.now());
}

export async function noteProofUploaded(ip) {
  if (!ip) return;
  const all = await readJSON('proofAttempts', {});
  const now = Date.now();
  for (const k of Object.keys(all)) {
    if (now - all[k].firstAt > PROOF_WINDOW_MS) delete all[k];
  }
  all[ip] = nextProofRateRecord(all[ip], now);
  await writeJSON('proofAttempts', all);
}

// ── Pembatas analytics publik (anti banjir /api/hit & /api/goal) ──
// Keduanya publik, tanpa auth, dan tiap panggilan baca-ubah-tulis SATU blob
// 'analytics' bersama (lihat recordHit/recordGoal). Tanpa batas ini siapa pun
// bisa memanggil endpoint berulang kali lewat script (bukan browser asli) dan
// membanjiri blob itu dengan write, menaikkan biaya invocation Netlify Functions
// dan memperbesar peluang lost-update di blob analytics. Batas dibuat longgar
// (jauh di atas pola klik-jelajah wajar) supaya pengunjung asli tak pernah kena.
const ANALYTICS_MAX_PER_WINDOW = 120; // maks panggilan hit+goal gabungan per IP
const ANALYTICS_WINDOW_MS = 10 * 60e3; // jendela 10 menit

// Logika murni (tanpa Blobs) — dipisah supaya bisa dites langsung.
export function computeAnalyticsRateStatus(rec, now) {
  if (!rec || now - rec.firstAt > ANALYTICS_WINDOW_MS) return { blocked: false, retryAfter: 0 };
  if (rec.count >= ANALYTICS_MAX_PER_WINDOW)
    return { blocked: true, retryAfter: Math.ceil((rec.firstAt + ANALYTICS_WINDOW_MS - now) / 1000) };
  return { blocked: false, retryAfter: 0 };
}
export function nextAnalyticsRateRecord(rec, now) {
  const r = (rec && now - rec.firstAt <= ANALYTICS_WINDOW_MS) ? rec : { count: 0, firstAt: now };
  return { count: r.count + 1, firstAt: r.firstAt };
}

export async function analyticsRateStatus(ip) {
  if (!ip) return { blocked: false, retryAfter: 0 };
  const all = await readJSON('analyticsAttempts', {});
  return computeAnalyticsRateStatus(all[ip], Date.now());
}

export async function noteAnalyticsHit(ip) {
  if (!ip) return;
  const all = await readJSON('analyticsAttempts', {});
  const now = Date.now();
  for (const k of Object.keys(all)) {
    if (now - all[k].firstAt > ANALYTICS_WINDOW_MS) delete all[k];
  }
  all[ip] = nextAnalyticsRateRecord(all[ip], now);
  await writeJSON('analyticsAttempts', all);
}

// Status pesanan yang sah (dipakai untuk memvalidasi input admin).
export const ORDER_STATUSES = ['menunggu_pembayaran', 'menunggu_verifikasi',
  'diproses', 'dikirim', 'selesai', 'batal'];

// Status order yang masih boleh menerima unggahan bukti bayar dari pembeli publik
// (endpoint /api/orders/:code/proof, tanpa auth). Di luar dua status ini order
// sudah masuk alur admin (diproses/dikirim/selesai) atau dibatalkan (batal) —
// mengizinkan unggah di sana bisa memaksa status mundur lagi ke
// "menunggu_verifikasi" dan, untuk order "batal", memicu applyStockTransition
// memotong stok yang sudah dikembalikan.
export const PROOF_UPLOADABLE_STATUSES = ['menunggu_pembayaran', 'menunggu_verifikasi'];

export const getOrders = () => readJSON('orders', []);

// Batasi panjang field data pengiriman dari checkout publik tanpa auth.
// Endpoint publik lain (hit.js, goal.js, cleanPriceItem di atas) semua
// membatasi panjang input teks bebas; /api/orders sebelumnya tidak — jadi
// address/note bisa berukuran bebas dan terus ditulis ke satu blob `orders`
// yang dibaca-tulis-ulang UTUH di tiap order baru & tiap upload bukti bayar.
export function sanitizeCustomer(customer) {
  return {
    name: (customer.name || '').toString().slice(0, 80),
    phone: (customer.phone || '').toString().slice(0, 20),
    address: (customer.address || '').toString().slice(0, 300),
    city: (customer.city || '').toString().slice(0, 60),
    note: (customer.note || '').toString().slice(0, 300),
  };
}

// Kembalikan stok produk untuk daftar item pesanan.
async function restoreStockFor(items) {
  if (!Array.isArray(items) || !items.length) return;
  const products = await getProducts();
  let touched = false;
  for (const it of items) {
    const p = products.find(x => x.id === it.id);
    if (p) { p.stock = (Number(p.stock) || 0) + (Number(it.qty) || 0); touched = true; }
  }
  if (touched) await saveProducts(products);
}
// Potong ulang stok (dipakai kalau order batal diaktifkan lagi oleh admin).
async function deductStockFor(items) {
  if (!Array.isArray(items) || !items.length) return;
  const products = await getProducts();
  let touched = false;
  for (const it of items) {
    const p = products.find(x => x.id === it.id);
    if (p) { p.stock = Math.max(0, (Number(p.stock) || 0) - (Number(it.qty) || 0)); touched = true; }
  }
  if (touched) await saveProducts(products);
}
// Cek stok tiap item terhadap snapshot produk yang diberikan, lalu kurangi
// langsung di snapshot itu kalau semuanya cukup. Dipisah dari I/O Blobs supaya
// bisa diuji sebagai fungsi murni. Mengembalikan array id produk yang stoknya
// tak cukup (kosong = berhasil, snapshot sudah dikurangi; ada isi = snapshot
// TIDAK diubah sama sekali, jadi gagal sebagian tidak pernah terjadi).
// Qty digabung per id LEBIH DULU: kalau `items` punya baris duplikat untuk id
// yang sama (mis. body request /api/orders dirakit manual), mengecek tiap
// baris terhadap stok mentah yang sama membuat keduanya lolos sendiri-sendiri
// padahal totalnya melebihi stok -> stok jadi minus setelah dipotong dua kali.
export function applyStockReservation(products, items) {
  const qtyById = new Map();
  for (const it of items) {
    qtyById.set(it.id, (qtyById.get(it.id) || 0) + (Number(it.qty) || 0));
  }
  const short = [];
  for (const [id, qty] of qtyById) {
    const p = products.find(x => x.id === id);
    if (!p || (Number(p.stock) || 0) < qty) short.push(id);
  }
  if (short.length) return short;
  for (const [id, qty] of qtyById) {
    const p = products.find(x => x.id === id);
    p.stock = (Number(p.stock) || 0) - qty;
  }
  return [];
}
// Cocokkan shippingId dari klien terhadap daftar opsi ongkir yang sah di
// settings. Dipisah jadi fungsi murni supaya bisa diuji: id yang tak dikenal
// (termasuk kosong/null/opsi yang sudah dihapus admin) HARUS ditolak, bukan
// diam-diam jatuh ke ongkir Rp0 — order lewat panggilan API langsung (bukan
// lewat form checkout) bisa memakai id apa saja.
export function resolveShipping(shippingOptions, shippingId) {
  return (shippingOptions || []).find(s => s.id === shippingId) || null;
}
// Paksa qty item pesanan jadi bilangan bulat >= 1. UI keranjang (cart.js) hanya
// pernah mengirim integer lewat tombol +/-, tapi /api/orders bisa dipanggil
// langsung (curl/devtools) dengan qty apa saja — sebelum fungsi ini, qty
// pecahan (mis. 2.7) lolos apa adanya dan mengurangi stok produk fisik jadi
// pecahan permanen di blob `products` (mis. stok "4.3"), padahal produk toko
// (sampo, alat salon, dst) hanya bisa dijual per unit utuh.
export function normalizeQty(raw) {
  return Math.max(1, Math.round(Number(raw)) || 1);
}
// Kurangi stok order baru dengan membaca ulang produk TERKINI tepat sebelum
// menulis — mempersempit jendela race antara pengecekan awal di orders.js dan
// penulisan akhir, supaya dua order yang datang nyaris bersamaan untuk unit
// terakhir sebuah produk tidak sama-sama lolos dan membuat stok minus.
export async function reserveStockFor(items) {
  if (!Array.isArray(items) || !items.length) return [];
  const products = await getProducts();
  const short = applyStockReservation(products, items);
  if (short.length) return short;
  await saveProducts(products);
  return [];
}
// Sesuaikan stok mengikuti perpindahan status; menandai `next.stockReturned`.
async function applyStockTransition(before, next) {
  const wasCanceled = before.status === 'batal';
  const nowCanceled = next.status === 'batal';
  if (!wasCanceled && nowCanceled && !before.stockReturned) {
    await restoreStockFor(before.items);
    next.stockReturned = true;
  } else if (wasCanceled && !nowCanceled && before.stockReturned) {
    await deductStockFor(before.items);
    next.stockReturned = false;
  }
}

export async function addOrder(o) {
  const list = await getOrders();
  const code = 'RR' + new Date().toISOString().slice(2, 10).replace(/-/g, '') +
    '-' + randomBytes(2).toString('hex').toUpperCase();
  const order = { id: 'o_' + Date.now().toString(36), code, ...o,
    status: 'menunggu_pembayaran', stockReturned: false, createdAt: Date.now() };
  list.unshift(order); await writeJSON('orders', list); return order;
}
export async function updateOrder(id, patch) {
  const list = await getOrders();
  const i = list.findIndex(o => o.id === id);
  if (i < 0) return null;
  const next = { ...list[i], ...patch };
  await applyStockTransition(list[i], next);
  list[i] = next;
  await writeJSON('orders', list); return list[i];
}
export async function updateOrderByCode(code, patch) {
  const list = await getOrders();
  const i = list.findIndex(o => o.code === code);
  if (i < 0) return null;
  const next = { ...list[i], ...patch };
  await applyStockTransition(list[i], next);
  list[i] = next;
  await writeJSON('orders', list); return list[i];
}

// Batalkan otomatis order yang telat bayar & kembalikan stoknya.
// Dipanggil "lazy" saat daftar order dibaca / order baru dibuat.
export async function expireStaleOrders() {
  const list = await getOrders();
  const now = Date.now();
  const toRestore = [];
  let changed = false;
  for (const o of list) {
    if (o.status === 'menunggu_pembayaran' && !o.stockReturned &&
        (now - (o.createdAt || 0)) > ORDER_HOLD_MS) {
      o.status = 'batal';
      o.stockReturned = true;
      o.autoCanceled = true;
      if (Array.isArray(o.items)) toRestore.push(...o.items);
      changed = true;
    }
  }
  if (changed) {
    await writeJSON('orders', list);
    await restoreStockFor(toRestore);
  }
  return list;
}

// ── Analitik pengunjung (dihitung sendiri via Blobs) ──
// Struktur blob 'analytics':
//   { total:{views,visitors}, days:{ 'YYYY-MM-DD':{views,visitors} },
//     pages:{ '/path':views }, seen:{ day, ids:{} }, firstAt, updatedAt }
const stats = () => getStore({ name: 'stats', consistency: 'strong' });
const emptyStats = () => ({ total: { views: 0, visitors: 0 }, days: {}, pages: {}, sources: {}, firstAt: Date.now(), updatedAt: Date.now() });

// Asal kunjungan → nama yang dimengerti pemilik toko.
// Parameter kampanye (?utm_source= / ?src=) menang atas referrer.
// Kembalikan '' untuk pindah-halaman di dalam situs sendiri (jangan dihitung).
const SOURCE_HOSTS = [
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook\.com|fb\.me|m\.me)$/, 'Facebook'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, 'WhatsApp'],
  [/(^|\.)google\.[a-z]{2,3}(\.[a-z]{2})?$/, 'Google Penelusuran'],
  [/(^|\.)(bing\.com|search\.yahoo\.com|duckduckgo\.com)$/, 'Mesin Pencari Lain'],
  [/(^|\.)threads\.(net|com)$/, 'Threads'],
];
const SOURCE_ALIAS = { yt: 'YouTube', youtube: 'YouTube', ig: 'Instagram', instagram: 'Instagram', wa: 'WhatsApp', whatsapp: 'WhatsApp', fb: 'Facebook', facebook: 'Facebook', tiktok: 'TikTok', tt: 'TikTok' };

export function classifySource(ref = '', campaign = '', selfHost = '') {
  const c = (campaign || '').toString().trim().toLowerCase().slice(0, 40);
  if (c) return SOURCE_ALIAS[c] || (c.charAt(0).toUpperCase() + c.slice(1));
  if (!ref) return 'Langsung';
  let host = '';
  try { host = new URL(ref).hostname.toLowerCase().replace(/^www\./, ''); } catch { return 'Langsung'; }
  if (!host) return 'Langsung';
  if (selfHost && (host === selfHost || host.endsWith('.' + selfHost))) return ''; // navigasi internal
  for (const [re, name] of SOURCE_HOSTS) if (re.test(host)) return name;
  return host.slice(0, 60);
}

function todayJakarta() {
  // Tanggal 'YYYY-MM-DD' menurut zona Asia/Jakarta (WIB, UTC+7)
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
}

// Penanda pengunjung: IP di-hash bersama tanggal (tak menyimpan IP mentah).
const VISITOR_SALT = 'rrhc-visitor';
function visitorId(ip, day) {
  if (!ip) return '';
  return createHmac('sha256', VISITOR_SALT).update(day + '|' + ip).digest('hex').slice(0, 16);
}

// path bisa datang apa adanya dari body request publik tanpa auth (POST /api/hit)
// — beda dari ref/campaign yang sudah di-.toString().slice() di hit.js sebelum
// dikirim ke sini. Kalau bukan string (objek/array/angka/dll), fallback ke '/'
// alih-alih crash di .slice() (dulu: TypeError tak tertangani -> 500).
export function normalizePath(path) {
  return (typeof path === 'string' && path ? path : '/').slice(0, 120);
}

// Keunikan pengunjung ditentukan SERVER dari IP, bukan dari klien (anti manipulasi).
export async function recordHit({ path = '/', ip = '', ref = '', campaign = '', selfHost = '' } = {}) {
  const a = (await stats().get('analytics', { type: 'json' })) || emptyStats();
  const day = todayJakarta();
  a.days[day] = a.days[day] || { views: 0, visitors: 0 };
  a.total.views++; a.days[day].views++;

  // Himpunan IP yang sudah tampil — hanya untuk hari berjalan, direset saat ganti hari.
  if (!a.seen || a.seen.day !== day) a.seen = { day, ids: {} };
  const id = visitorId(ip, day);
  if (id && !a.seen.ids[id]) {
    a.seen.ids[id] = 1;
    a.total.visitors++; a.days[day].visitors++;
  }

  const p = normalizePath(path);
  a.pages[p] = (a.pages[p] || 0) + 1;

  // Asal kunjungan: dicatat sekali per pengunjung per hari (bukan tiap halaman),
  // supaya klik-klik di dalam situs tak menggelembungkan angkanya.
  const src = classifySource(ref, campaign, selfHost);
  if (src) {
    a.sources = a.sources || {};
    const firstOfDay = !id || a.seen.ids[id] === 1; // 1 = baru saja dihitung sebagai pengunjung baru
    if (firstOfDay) {
      a.sources[src] = a.sources[src] || { total: 0, days: {} };
      a.sources[src].total++;
      a.sources[src].days[day] = (a.sources[src].days[day] || 0) + 1;
      if (id) a.seen.ids[id] = 2; // tandai sudah punya sumber, jangan dihitung lagi hari ini
    }
  }
  a.updatedAt = Date.now();
  await stats().setJSON('analytics', a);
  return a;
}

// Sasaran konversi: peristiwa yang benar-benar berarti buat salon, terutama
// klik booking WhatsApp. Dicatat terpisah dari kunjungan biasa, lengkap dengan
// ASAL pengunjungnya — supaya pertanyaan "kanal mana yang mengisi kursi salon?"
// bisa dijawab, bukan cuma "kanal mana yang mengirim trafik".
export const GOAL_NAMES = ['booking_form', 'booking_chat', 'pesanan_toko', 'lamaran_kerja'];
// Titik tombol yang diklik — menjawab "tombol mana yang sebenarnya dipakai orang",
// supaya penempatan tombol bisa diperbaiki berdasar data, bukan tebakan.
export const GOAL_SPOTS = ['form', 'float', 'lokasi', 'footer', 'karir', 'checkout'];

export async function recordGoal({ name = '', spot = '', ref = '', campaign = '', selfHost = '' } = {}) {
  if (!GOAL_NAMES.includes(name)) return null;
  const a = (await stats().get('analytics', { type: 'json' })) || emptyStats();
  const day = todayJakarta();

  a.goals = a.goals || {};
  const g = (a.goals[name] = a.goals[name] || { total: 0, days: {}, sources: {} });
  g.total++;
  g.days[day] = (g.days[day] || 0) + 1;

  if (GOAL_SPOTS.includes(spot)) {
    g.spots = g.spots || {};
    g.spots[spot] = (g.spots[spot] || 0) + 1;
  }

  // Asal DIAMBIL DARI AWAL SESI (dikirim klien), bukan dari halaman tempat
  // tombol diklik — kalau tidak, semua konversi tampak berasal dari situs sendiri.
  const src = classifySource(ref, campaign, selfHost) || 'Langsung';
  g.sources[src] = (g.sources[src] || 0) + 1;

  a.updatedAt = Date.now();
  await stats().setJSON('analytics', a);
  return g;
}

export async function getStats() {
  const a = (await stats().get('analytics', { type: 'json' })) || emptyStats();
  const { seen, ...rest } = a; // jangan kirim daftar IP ter-hash ke panel
  return rest;
}

// ── Daftar Harga (layanan salon) ──
export const getPricelist = () => readJSON('pricelist', []);
export const savePricelist = (list) => writeJSON('pricelist', list);
const newPriceId = () => 'h_' + Date.now().toString(36) + randomBytes(3).toString('hex');

function cleanPriceItem(p) {
  return {
    id: p.id || newPriceId(),
    category: (p.category || 'Lainnya').toString().slice(0, 60),
    name: (p.name || '').toString().slice(0, 120),
    price: Number(p.price) || 0,
    promo: Number(p.promo) || 0,
    duration: (p.duration || '').toString().slice(0, 30),
  };
}
export async function addPriceItem(p) {
  const list = await getPricelist();
  const item = cleanPriceItem(p);
  list.push(item); await savePricelist(list); return item;
}
export async function updatePriceItem(id, patch) {
  const list = await getPricelist();
  const i = list.findIndex(x => x.id === id);
  if (i < 0) return null;
  list[i] = cleanPriceItem({ ...list[i], ...patch, id });
  await savePricelist(list); return list[i];
}
export async function deletePriceItem(id) {
  await savePricelist((await getPricelist()).filter(x => x.id !== id));
}

// Parser CSV export POS salon → daftar harga rapi.
export function parsePricelistCsv(text) {
  const lines = String(text || '').split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) { if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else { if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c; }
    }
    out.push(cur); return out;
  };
  const dec = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
  const idr = (s) => parseInt(String(s || '').split(',')[0].replace(/[^\d]/g, ''), 10) || 0;
  const header = parseLine(lines[0]).map(h => h.replace(/\s+/g, ' ').trim());
  const col = (name) => header.indexOf(name);
  const iType = col('Type'), iTreat = col('Treatment Name'), iGroup = col('Group Name'),
        iItem = col('Item Name'), iRetail = col('Retail Price'), iSpecial = col('Special Price'), iDur = col('Duration');
  if (iItem < 0 || iRetail < 0) return []; // format tak dikenali
  const items = [];
  for (let r = 1; r < lines.length; r++) {
    const f = parseLine(lines[r]);
    if (f.length <= iRetail) continue;
    const name = dec(f[iItem]); if (!name) continue;
    const price = idr(f[iRetail]); if (price <= 0) continue;
    let cat = dec(f[iTreat]);
    if (!cat || cat === 'Other') cat = dec(f[iGroup]);
    if (f[iType] === 'Package') cat = 'Paket Layanan';
    else if (!cat || cat === 'Paket Layanan') cat = 'Lainnya'; // add-on salah grup
    if (cat === 'Coloring') cat = 'Coloring & Highlight';
    const sp = idr(f[iSpecial]);
    const promo = (sp > 0 && sp < price) ? sp : 0;
    let dur = dec(iDur >= 0 ? f[iDur] : '');
    items.push(cleanPriceItem({ category: cat, name, price, promo, duration: dur }));
  }
  return items;
}
export async function importPricelistCsv(text) {
  const list = parsePricelistCsv(text);
  if (!list.length) {
    const err = new Error('CSV tidak berisi baris valid — format tidak dikenali atau file kosong');
    err.code = 'CSV_EMPTY';
    throw err;
  }
  await savePricelist(list);
  return list;
}

// ── Galeri (foto hasil kerja di landing) ──
export const getGallery = () => readJSON('gallery', []);
export async function addGalleryPhoto(p) {
  const list = await getGallery();
  const item = { id: 'g_' + Date.now().toString(36) + randomBytes(2).toString('hex'),
    image: p.image || '', caption: (p.caption || '').slice(0, 80), createdAt: Date.now() };
  list.unshift(item); await writeJSON('gallery', list); return item;
}
export async function deleteGalleryPhoto(id) {
  const list = await getGallery();
  const item = list.find(g => g.id === id);
  await writeJSON('gallery', list.filter(g => g.id !== id));
  if (item && item.image) await deleteMediaByUrl(item.image);
}

// ── Foto tetap per bagian halaman (slot bernama, mis. 'about') ──
// Disimpan sebagai objek { slot: urlMedia }, dipakai untuk foto yang sering diganti.
export const getSiteImages = () => readJSON('siteImages', {});
export async function setSiteImage(key, url) {
  const m = await getSiteImages();
  const oldUrl = m[key];
  m[key] = url; await writeJSON('siteImages', m);
  if (oldUrl && oldUrl !== url) await deleteMediaByUrl(oldUrl);
  return m;
}
export async function deleteSiteImage(key) {
  const m = await getSiteImages();
  const oldUrl = m[key];
  delete m[key]; await writeJSON('siteImages', m);
  if (oldUrl) await deleteMediaByUrl(oldUrl);
  return m;
}

// ── Media (foto) — disimpan sebagai blob biner ──
// Terima data URL base64 (mis. "data:image/jpeg;base64,...."), simpan, balikin URL /api/media/<key>.
export const MAX_MEDIA_BYTES = 4 * 1024 * 1024; // batas ~4 MB per gambar
// Hanya format raster — SVG DILARANG: bisa memuat <script>, dan /api/media/:key
// menyajikannya dengan content-type aslinya sehingga kalau dibuka langsung
// (mis. via target="_blank" di bukti-bayar admin) script di dalamnya jalan
// sebagai halaman situs sendiri — bisa mencuri token admin dari sessionStorage.
// order-proof.js (upload bukti bayar) TANPA login, jadi ini jalur publik.
const ALLOWED_MEDIA_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
export async function saveMedia(dataUrl) {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return '';
  const contentType = m[1].toLowerCase();
  if (!ALLOWED_MEDIA_TYPES.has(contentType)) return '';
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX_MEDIA_BYTES) {
    const e = new Error('MEDIA_TOO_LARGE'); e.code = 'MEDIA_TOO_LARGE'; throw e;
  }
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

// Ekstrak key blob dari URL yang dikembalikan saveMedia (mis. '/api/media/abc123.jpg'
// -> 'abc123.jpg'). Fungsi murni — dipisah supaya bisa dites tanpa Blobs. URL yang
// bukan milik kita sendiri (kosong, eksternal, format lain) mengembalikan ''.
export function mediaKeyFromUrl(url) {
  const m = /^\/api\/media\/([^/?#]+)$/.exec(String(url || ''));
  return m ? m[1] : '';
}
// Hapus blob media lama yang sudah tidak dirujuk siapa pun (foto diganti/dihapus).
// Diam-diam abaikan URL yang bukan media kita sendiri atau kalau delete gagal —
// ini pembersihan best-effort, bukan bagian dari alur kritis penyimpanan data.
export async function deleteMediaByUrl(url) {
  const key = mediaKeyFromUrl(url);
  if (!key) return;
  try { await media().delete(key); } catch { /* best-effort */ }
}

// ── Helper HTTP ──
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

export async function requireAuth(req) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const s = await getSettings();
  return verifyToken(token, s.authSecret) ? s : null;
}
