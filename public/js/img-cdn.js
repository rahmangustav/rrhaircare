// URL foto lewat Netlify Image CDN — dipakai browser (gallery.js) dan saat
// build (scripts/prerender.js) supaya versi statis dan runtime sama persis.
//
// Foto unggahan sudah dikecilkan ke maks 1200px saat diunggah (img.js), tapi
// tetap JPEG ~170 KB. Lewat CDN, foto hero turun jadi ~31 KB webp — LCP jauh
// lebih ringan tanpa menyentuh file aslinya di Netlify Blobs.
//
// Hanya untuk /api/media/*. Aset lain (logo, og) dibiarkan apa adanya.
function fotoCdn(url, lebar) {
  if (!url || String(url).indexOf('/api/media/') !== 0) return url;
  return '/.netlify/images?url=' + encodeURIComponent(url) +
    '&w=' + (lebar || 800) + '&fm=webp&q=72';
}

// Kalau Image CDN mati, jatuh ke berkas aslinya daripada gambar rusak.
// Dipasang sebagai atribut onerror, jadi harus aman di dalam kutip ganda.
function fallbackOnError(urlAsli) {
  return "this.onerror=null;this.src='" + String(urlAsli).replace(/'/g, '%27') + "'";
}

(typeof window !== 'undefined' ? window : globalThis).ImgCdn =
  { fotoCdn: fotoCdn, fallbackOnError: fallbackOnError };
