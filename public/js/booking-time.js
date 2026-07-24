// Logika murni tanggal/jam form booking (WIB) — dipakai index.html, dites di Node.
// WIB = UTC+7 tanpa DST. Digeser manual dari epoch ms supaya benar untuk semua
// pengunjung, termasuk yang membuka situs dari luar zona WIB. Pola sama dengan
// todayJakarta() di netlify/lib/data.js — sengaja disamakan biar konsisten.
function wibDate(nowMs) {
  return new Date((nowMs == null ? Date.now() : nowMs) + 7 * 3600e3);
}
// 'YYYY-MM-DD' menurut tanggal WIB saat ini.
function todayWIB(nowMs) {
  return wibDate(nowMs).toISOString().slice(0, 10);
}
// "09:00 - 10:00" -> 540 (menit sejak 00:00 WIB). null kalau format tak dikenali.
function slotStartMinutes(jamRange) {
  const m = /^(\d{2}):(\d{2})/.exec(jamRange || '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
// Jam yang dipilih sudah lewat waktu WIB sekarang? Hanya relevan kalau tanggal
// yang dipilih adalah hari ini — tanggal masa depan tidak pernah "lewat".
function isSlotPast(tanggal, jamRange, nowMs) {
  if (!tanggal || tanggal !== todayWIB(nowMs)) return false;
  const startMin = slotStartMinutes(jamRange);
  if (startMin == null) return false;
  const w = wibDate(nowMs);
  const nowMin = w.getUTCHours() * 60 + w.getUTCMinutes();
  return nowMin >= startMin;
}

// Format 'YYYY-MM-DD' (nilai mentah <input type="date">) jadi teks tanggal
// panjang Indonesia untuk pesan WhatsApp booking. TIDAK boleh lewat
// `new Date(tanggalStr)` lalu format langsung — 'YYYY-MM-DD' diparse sebagai
// tengah malam UTC, lalu toLocaleDateString() memformatnya pakai timezone
// LOKAL perangkat pengunjung. Untuk pengunjung yang timezone-nya di belakang
// UTC (mis. diaspora WNI membuka situs dari Amerika), hasilnya mundur satu
// hari dari tanggal yang sebenarnya dipilih di date picker — pesan yang
// dikirim ke salon jadi salah tanggal. Membangun Date dari komponen
// tahun/bulan/tanggal lokal (bukan dari string) membuat konstruksi & format
// sama-sama "lokal" tanpa perjalanan lewat UTC di tengah, jadi hasilnya benar
// di timezone manapun.
function formatBookingDate(tanggal) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal || '');
  if (!m) return tanggal || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

(typeof window !== 'undefined' ? window : globalThis).BookingTime =
  { todayWIB, slotStartMinutes, isSlotPast, formatBookingDate };
