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
    // Teks alternatif per slot — sebelumnya semua foto tetap ber-alt "RR Hair Care",
    // yang tidak memberi tahu apa pun ke pembaca layar maupun mesin pencari.
    var ALT = {
      hero: 'Suasana salon RR Hair Care di Koja, Jakarta Utara',
      about: 'Rani Apriyani dan Ratih Handayani, pendiri RR Hair Care',
      'layanan-haircut': 'Layanan potong rambut di RR Hair Care',
      'layanan-coloring': 'Layanan coloring dan highlight di RR Hair Care',
      'layanan-smoothing': 'Layanan smoothing dan rebonding di RR Hair Care',
      'layanan-hairspa': 'Layanan hair spa dan treatment di RR Hair Care',
      'layanan-nailart': 'Layanan nail art di RR Hair Care',
      'layanan-paket': 'Paket layanan hemat di RR Hair Care',
    };
    document.querySelectorAll('[data-slot]').forEach(function (el) {
      var slot = el.getAttribute('data-slot');
      var lebar = slot === 'hero' ? 840 : (slot === 'about' ? 800 : 720);
      if (imgs[slot]) return pasang(el, imgs[slot], ALT[slot] || 'RR Hair Care', lebar);
      // Hero belum diisi di admin: pinjam foto galeri TERBARU. Ini cuma jaring
      // pengaman — artinya foto pembuka halaman ikut berganti tiap ada unggahan
      // baru, dan bisa berakhir menampilkan nail art di situs salon rambut.
      // Isi slot "hero" di admin supaya tetap.
      if (slot === 'hero' && galeri.length) {
        return pasang(el, galeri[0].image, galeri[0].caption || ALT.hero, lebar);
      }
      if (el.classList.contains('service-photo')) el.hidden = true;
    });
  });
})();
