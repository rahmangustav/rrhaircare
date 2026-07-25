// Info pesanan yang sedang menunggu bayar disimpan di sessionStorage — bukan cuma
// variabel JS `order` di checkout.html. Tanpa ini, kalau pelanggan me-refresh/reload
// halaman checkout SETELAH pesanan berhasil dibuat (step 2, sebelum unggah bukti bayar),
// keranjang sudah dikosongkan (lihat showPayment() di checkout.html) sehingga guard
// "keranjang kosong -> balik ke /toko" langsung mengusirnya kembali ke toko, kehilangan
// kode pesanan, QRIS, dan link konfirmasi WhatsApp — padahal pesanannya sudah tercatat
// di server dan menunggu pembayaran.
const PENDING_ORDER_KEY = 'rrhc_pending_order';

function savePendingOrder(order) {
  try { sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify({ code: order.code, total: order.total })); }
  catch { /* sessionStorage penuh/nonaktif -- cuma memengaruhi pemulihan saat reload */ }
}
function loadPendingOrder() {
  try { return JSON.parse(sessionStorage.getItem(PENDING_ORDER_KEY) || 'null'); }
  catch { return null; }
}
function clearPendingOrder() {
  try { sessionStorage.removeItem(PENDING_ORDER_KEY); } catch { /* abaikan */ }
}

(typeof window !== 'undefined' ? window : globalThis).CheckoutPending =
  { savePendingOrder, loadPendingOrder, clearPendingOrder };
