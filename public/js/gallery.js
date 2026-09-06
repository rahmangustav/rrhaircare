// Isi section Galeri + slot foto tetap di landing dari /api/gallery & /api/site-images.
// Keduanya diambil sekali saja, lalu dipakai bersama.
(function () {
  var grid = document.getElementById('galleryGrid');
  if (!grid) return;
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var ambil = function (url, fallback) {
    return fetch(url).then(function (r) { return r.json(); }).catch(function () { return fallback; });
  };

  Promise.all([ambil('/api/gallery', []), ambil('/api/site-images', {})]).then(function (hasil) {
    var galeri = Array.isArray(hasil[0]) ? hasil[0] : [];
    var imgs = hasil[1] && typeof hasil[1] === 'object' ? hasil[1] : {};

    // Grid galeri. Kalau belum ada foto, placeholder bawaan dibiarkan.
    if (galeri.length) {
      grid.innerHTML = galeri.map(function (g) {
        var cap = g.caption ? esc(g.caption) : 'Lihat';
        return '<div class="gallery-item">' +
          '<img src="' + esc(g.image) + '" alt="' + esc(g.caption || 'Hasil kerja RR Hair Care') + '" loading="lazy"/>' +
          '<div class="gallery-overlay"><span>' + cap + '</span></div></div>';
      }).join('');
    }

    // Foto tetap per bagian halaman (mis. slot "about" = Foto Rani & Ratih).
    // Slot yang belum diisi tidak boleh tampil sebagai kotak kosong: hero pinjam
    // foto galeri terbaru, kartu layanan menyembunyikan area fotonya.
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
