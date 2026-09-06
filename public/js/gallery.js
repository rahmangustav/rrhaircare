// Isi section Galeri + slot foto tetap di landing dari /api/gallery & /api/site-images.
// Keduanya diambil sekali saja, lalu dipakai bersama.
(function () {
  var grid = document.getElementById('galleryGrid');
  if (!grid) return;
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var C = window.ImgCdn || { fotoCdn: function (u) { return u; }, fallbackOnError: function () { return ''; } };
  // <img> lewat Image CDN, dengan data-full versi besar untuk lightbox.
  var imgTag = function (url, alt, lebar, lebarPenuh) {
    return '<img src="' + esc(C.fotoCdn(url, lebar)) + '"' +
      (lebarPenuh ? ' data-full="' + esc(C.fotoCdn(url, lebarPenuh)) + '"' : '') +
      ' alt="' + esc(alt) + '" loading="lazy" onerror="' + esc(C.fallbackOnError(url)) + '"/>';
  };

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
          imgTag(g.image, g.caption || 'Hasil kerja RR Hair Care', 600, 1400) +
          '<div class="gallery-overlay"><span>' + cap + '</span></div></div>';
      }).join('');
    }

    // Foto tetap per bagian halaman (mis. slot "about" = Foto Rani & Ratih).
    // Slot yang belum diisi tidak boleh tampil sebagai kotak kosong: hero pinjam
    // foto galeri terbaru, kartu layanan menyembunyikan area fotonya.
    // Hero adalah elemen terbesar di layar (LCP): jangan lazy, dan minta lebar
    // yang pas dengan tampilannya (maks 420px CSS x2 untuk layar padat).
    var pasang = function (el, url, alt, lebar) {
      el.innerHTML = imgTag(url, alt, lebar || 800, 1400)
        .replace(' loading="lazy"', el.getAttribute('data-slot') === 'hero' ? ' fetchpriority="high"' : ' loading="lazy"');
      el.removeAttribute('hidden'); // slot yang disembunyikan saat build kini terisi
    };
    document.querySelectorAll('[data-slot]').forEach(function (el) {
      var slot = el.getAttribute('data-slot');
      var lebar = slot === 'hero' ? 840 : (slot === 'about' ? 800 : 720);
      if (imgs[slot]) return pasang(el, imgs[slot], 'RR Hair Care', lebar);
      if (slot === 'hero' && galeri.length) {
        return pasang(el, galeri[0].image, galeri[0].caption || 'Hasil kerja RR Hair Care', lebar);
      }
      if (el.classList.contains('service-photo')) el.hidden = true;
    });
  });
})();
