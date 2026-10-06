// Interaksi landing RR Hair Care (versi sinematik, Okt 2026).
// - Smooth scroll (Lenis) kalau tersedia.
// - Bagian "story": 5 adegan dipasang sticky; posisi scroll diubah jadi angka
//   adegan (window.RR_STORY.p, 0..5; .prog[i] = kemajuan di dalam adegan i) yang juga dibaca js/rr3d.js untuk objek 3D.
// - Navbar, menu HP, animasi muncul, kartu layanan → daftar harga, galeri geser,
//   video hanya diputar saat terlihat.
// Konten tetap terlihat kalau skrip gagal (kelas .js di <head> + jaring pengaman).
(function () {
  var diam = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, el) { return (el || document).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var halus = function (t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  // ── Smooth scroll ──
  var lenis = null;
  if (window.Lenis && !diam) {
    lenis = new window.Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
    (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
    // Tautan jangkar ikut halus
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el, { offset: id === '#hero' ? 0 : -10, duration: 1.4 });
    });
  }
  function keTitik(y) { if (lenis) lenis.scrollTo(y, { duration: 1.3 }); else window.scrollTo({ top: y, behavior: diam ? 'auto' : 'smooth' }); }

  // ── Menu HP ──
  window.toggleMenu = function () {
    var buka = document.body.classList.toggle('menu-open');
    var b = $('.hamburger');
    if (b) b.setAttribute('aria-label', buka ? 'Tutup menu' : 'Buka menu');
    if (lenis) { buka ? lenis.stop() : lenis.start(); } else document.body.style.overflow = buka ? 'hidden' : '';
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) window.toggleMenu();
  });

  // ── STORY ──
  var story = $('#hero'), panels = $$('.st-panel'), N = panels.length || 5;
  var langkah = $$('#stLangkah li'), tot = $('#stTot');
  var vid = $('#stVideo'), ring = $('#stRing'), hint = $('#stHint'), num = $('#stNum');
  var dots = $$('#stDots button');
  // Panjang "diam" tiap adegan (satuan = 75vh scroll). Adegan potong rambut
  // (indeks 3) dibuat panjang karena animasinya berjalan mengikuti scroll.
  var TAHAN = [0.55, 0.55, 0.55, 2.6, 0.55, 0.55].slice(0, N), TRANS = 0.9, SATUAN = 75;
  while (TAHAN.length < N) TAHAN.push(0.55);
  var TOTAL = TAHAN.reduce(function (a, b) { return a + b; }, 0) + TRANS * (N - 1);
  if (story) story.style.height = (TOTAL * SATUAN + 100) + 'vh';
  window.RR_STORY = { p: 0, aktif: true, prog: TAHAN.map(function () { return 0; }) };

  function posisiStory() {
    var r = story.getBoundingClientRect();
    var jarak = story.offsetHeight - window.innerHeight;
    var x = clamp(-r.top / jarak, 0, 1) * TOTAL, p = N - 1, prog = [];
    for (var i = 0, sisa = x, ketemu = false; i < N; i++) {
      if (ketemu) { prog.push(0); continue; }
      if (sisa <= TAHAN[i]) { p = i; prog.push(sisa / TAHAN[i]); ketemu = true; continue; }
      sisa -= TAHAN[i]; prog.push(1);
      if (i < N - 1 && sisa <= TRANS) { p = i + halus(sisa / TRANS); ketemu = true; continue; }
      sisa -= TRANS;
    }
    return { p: p, prog: prog, terlihat: r.bottom > 0 };
  }
  // Posisi scroll awal "diam" adegan ke-i (untuk tombol titik).
  function awalAdegan(i) {
    var x = 0; for (var k = 0; k < i; k++) x += TAHAN[k] + TRANS;
    return story.offsetTop + (story.offsetHeight - window.innerHeight) * (x / TOTAL);
  }

  function lukisStory() {
    var s = posisiStory(), p = s.p;
    window.RR_STORY.p = p; window.RR_STORY.aktif = s.terlihat; window.RR_STORY.prog = s.prog;
    if (langkah.length) { var u = s.prog[3] || 0, aktifL = u < 0.12 ? 0 : (u < 0.56 ? 1 : 2); langkah.forEach(function (li, k) { li.classList.toggle('on', k === aktifL); li.classList.toggle('lewat', k < aktifL); }); }
    panels.forEach(function (el, i) {
      var d = p - i, a = Math.abs(d);
      var o = clamp(1 - a * 1.7, 0, 1);
      el.style.opacity = o;
      var geser = (-d * 70).toFixed(1);
      var skala = (1 + d * -0.06).toFixed(3);
      el.style.filter = a > 0.02 ? 'blur(' + (a * 14).toFixed(1) + 'px)' : 'none';
      el.style.translate = '0 ' + geser + 'px';
      el.style.scale = skala;
      el.classList.toggle('on', a < 0.35);
      el.setAttribute('aria-hidden', a < 0.5 ? 'false' : 'true');
    });
    if (vid) {
      var v = clamp(1 - p * 1.25, 0, 1);
      vid.style.opacity = v;
      vid.style.filter = p > 0.02 ? 'blur(' + (p * 16).toFixed(1) + 'px)' : 'none';
      vid.style.transform = 'scale(' + (1 + p * 0.18).toFixed(3) + ')';
    }
    if (ring) {
      var q = clamp((p - (N - 2)) * 1.4, 0, 1);
      ring.style.opacity = q;
      ring.style.scale = (0.7 + q * 0.3).toFixed(3);
    }
    var aktif = Math.round(p);
    dots.forEach(function (b, i) { b.classList.toggle('on', i === aktif); });
    if (num) num.textContent = '0' + (aktif + 1);
    if (tot) tot.textContent = '0' + N;
    if (hint) hint.style.opacity = p < 0.15 ? 1 : 0;
  }
  dots.forEach(function (b, i) {
    b.addEventListener('click', function () {
      keTitik(awalAdegan(i) + 2);
    });
  });

  // ── Gulir umum: navbar, progres, WA ──
  var nav = $('#navbar'), bar = $('#progress'), wa = $('.wa-float');
  var yLama = 0, antri = false;
  function gulir() {
    antri = false;
    var y = window.scrollY, h = window.innerHeight;
    var maks = document.documentElement.scrollHeight - h;
    if (story) lukisStory();
    if (nav) {
      var lewatStory = story ? y > story.offsetHeight - h * 0.9 : y > 40;
      nav.classList.toggle('scrolled', lewatStory);
      nav.classList.toggle('hide', lewatStory && y > yLama + 4 && !document.body.classList.contains('menu-open'));
      if (y < yLama - 4) nav.classList.remove('hide');
    }
    if (bar) bar.style.transform = 'scaleX(' + (maks > 0 ? y / maks : 0) + ')';
    if (wa) wa.classList.toggle('show', story ? y > story.offsetHeight - h * 0.6 : y > h * 0.8);
    yLama = y;
  }
  function minta() { if (!antri) { antri = true; requestAnimationFrame(gulir); } }
  window.addEventListener('scroll', minta, { passive: true });
  window.addEventListener('resize', minta);
  if (lenis) lenis.on('scroll', minta);
  gulir();

  // ── Muncul saat terlihat ──
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      io.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  function amati() { $$('.fade-up:not(.visible)').forEach(function (el) { io.observe(el); }); }
  amati();
  window.addEventListener('load', amati);
  // Jaring pengaman: tab latar belakang membekukan IntersectionObserver di Chrome.
  function tampilkanSisanya() {
    $$('.fade-up:not(.visible)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) el.classList.add('visible');
    });
  }
  window.addEventListener('load', function () { setTimeout(tampilkanSisanya, 300); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(tampilkanSisanya, 100); });

  // ── Kartu layanan → buka kategori di daftar harga ──
  $$('.service-card[data-kategori]').forEach(function (card) {
    card.setAttribute('tabindex', '0');
    card.setAttribute('role', 'link');
    function buka() {
      var kat = card.getAttribute('data-kategori');
      var cocok = $$('#priceWrap details.price-cat').filter(function (d) {
        var h = d.querySelector('h3'); return h && h.textContent.trim() === kat;
      })[0];
      if (cocok) cocok.open = true;
      var tujuan = cocok || $('#harga');
      keTitik(tujuan.getBoundingClientRect().top + window.scrollY - 90);
    }
    card.addEventListener('click', buka);
    card.addEventListener('keydown', function (e) { if (e.key === 'Enter') buka(); });
  });

  // ── Galeri geser: tombol panah + bilah posisi ──
  var gal = $('#galleryGrid'), galBar = $('#galBar');
  if (gal) {
    var langkahGal = function () { var it = gal.querySelector('.gallery-item'); return it ? it.getBoundingClientRect().width + 18 : 300; };
    $$('[data-gal]').forEach(function (b) {
      b.addEventListener('click', function () { gal.scrollBy({ left: langkahGal() * +b.getAttribute('data-gal'), behavior: diam ? 'auto' : 'smooth' }); });
    });
    var posisiGal = function () {
      var maks = gal.scrollWidth - gal.clientWidth;
      var k = maks > 0 ? gal.scrollLeft / maks : 0;
      if (galBar) { var lebar = Math.max(12, Math.min(100, gal.clientWidth / gal.scrollWidth * 100)); galBar.style.width = lebar + '%'; galBar.style.left = (k * (100 - lebar)) + '%'; }
      $$('[data-gal]').forEach(function (b) { b.disabled = (+b.getAttribute('data-gal') < 0 ? k <= 0.01 : k >= 0.99); });
    };
    gal.addEventListener('scroll', posisiGal, { passive: true });
    window.addEventListener('resize', posisiGal);
    window.addEventListener('load', posisiGal);
    new MutationObserver(posisiGal).observe(gal, { childList: true });
    posisiGal();
  }

  // ── Video: putar hanya saat terlihat (hemat baterai & kuota) ──
  $$('video').forEach(function (v) {
    if (diam) { v.removeAttribute('autoplay'); v.pause(); return; }
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var tampak = e.isIntersecting && getComputedStyle(v.closest('.st-video, .st-ring') || v).opacity !== '0';
        if (tampak) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.05 });
    vio.observe(v);
  });
  // Video di cincin adegan terakhir baru dimuat/diputar saat mulai tampak.
  var ringVid = ring && ring.querySelector('video');
  if (ringVid && !diam) {
    var mainCincin = false;
    setInterval(function () {
      var tampak = parseFloat(ring.style.opacity || 0) > 0.05;
      if (tampak && !mainCincin) { mainCincin = true; var pr = ringVid.play(); if (pr && pr.catch) pr.catch(function () {}); }
      else if (!tampak && mainCincin) { mainCincin = false; ringVid.pause(); }
    }, 400);
  }
})();
