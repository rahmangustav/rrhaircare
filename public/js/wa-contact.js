// Nomor WhatsApp yang dipakai tombol booking & kontak di landing page HARUS
// ikut nomor yang diatur admin lewat /api/settings, bukan angka tetap di HTML —
// checkout.html & admin.js sudah begitu, index.html sebelumnya belum, jadi
// kalau nomor WA salon diganti dari panel admin, tombol booking di halaman
// utama tetap mengarah ke nomor lama.
(function (global) {
  function normalize(raw, fallback) {
    const digits = String(raw || '').replace(/\D/g, '');
    return digits || fallback;
  }

  function buildUrl(number, text) {
    const q = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${number}${q}`;
  }

  global.WaContact = { normalize, buildUrl };
})(typeof window !== 'undefined' ? window : globalThis);
