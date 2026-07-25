// Isi section Galeri di landing dari /api/gallery.
// Kalau belum ada foto, biarkan placeholder bawaan (tidak diubah).
(function () {
  var grid = document.getElementById('galleryGrid');
  if (!grid) return;
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  fetch('/api/gallery').then(function (r) { return r.json(); }).then(function (list) {
    if (!Array.isArray(list) || !list.length) return; // pertahankan placeholder
    grid.innerHTML = list.map(function (g) {
      var cap = g.caption ? '<span>' + esc(g.caption) + '</span>' : '<span>Lihat</span>';
      // tabindex+role: div biasa tidak bisa difokus keyboard, padahal klik-nya
      // membuka lightbox — tanpa ini pengguna keyboard tak pernah bisa melihat fotonya.
      return '<div class="gallery-item" tabindex="0" role="button" aria-label="Lihat foto: ' +
        esc(g.caption || 'hasil kerja RR Hair Care') + '">' +
        '<img src="' + esc(g.image) + '" alt="' + esc(g.caption || 'Hasil kerja RR Hair Care') + '" loading="lazy"/>' +
        '<div class="gallery-overlay">' + cap + '</div></div>';
    }).join('');
  }).catch(function () {});

  // Foto tetap per bagian halaman (mis. slot "about" = Foto Rani & Ratih)
  fetch('/api/site-images').then(function (r) { return r.json(); }).then(function (imgs) {
    if (!imgs || typeof imgs !== 'object') return;
    document.querySelectorAll('[data-slot]').forEach(function (el) {
      var url = imgs[el.getAttribute('data-slot')];
      if (!url) return;
      el.innerHTML = '<img src="' + esc(url) + '" alt="RR Hair Care" loading="lazy"/>';
      // Sama seperti item galeri: baru bisa difokus keyboard setelah foto asli terpasang.
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', 'Lihat foto RR Hair Care');
    });
  }).catch(function () {});
})();
