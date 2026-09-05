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

  // Foto tetap per bagian halaman (mis. slot "about" = Foto Rani & Ratih).
  // Slot yang belum diisi tidak boleh tampil sebagai kotak kosong: hero pinjam
  // foto galeri terbaru, kartu layanan menyembunyikan area fotonya.
  Promise.all([
    fetch('/api/site-images').then(function (r) { return r.json(); }).catch(function () { return {}; }),
    fetch('/api/gallery').then(function (r) { return r.json(); }).catch(function () { return []; })
  ]).then(function (hasil) {
    var imgs = hasil[0] && typeof hasil[0] === 'object' ? hasil[0] : {};
    var galeri = Array.isArray(hasil[1]) ? hasil[1] : [];
    var pasang = function (el, url, alt) {
      el.innerHTML = '<img src="' + esc(url) + '" alt="' + esc(alt) + '" loading="lazy"/>';
    };
    document.querySelectorAll('[data-slot]').forEach(function (el) {
      var slot = el.getAttribute('data-slot');
      if (imgs[slot]) return pasang(el, imgs[slot], 'RR Hair Care');
      if (slot === 'hero' && galeri.length) {
        return pasang(el, galeri[0].image, galeri[0].caption || 'Hasil kerja RR Hair Care');
      }
      if (el.classList.contains('service-photo')) el.remove();
    });
  });
})();
