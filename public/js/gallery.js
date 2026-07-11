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
      return '<div class="gallery-item">' +
        '<img src="' + esc(g.image) + '" alt="' + esc(g.caption || 'Hasil kerja RR Hair Care') + '" loading="lazy"/>' +
        '<div class="gallery-overlay">' + cap + '</div></div>';
    }).join('');
  }).catch(function () {});
})();
