// Lightbox: klik foto galeri / foto "Tentang Kami" → tampil besar.
// Pakai event delegation supaya jalan untuk foto yang dimuat dinamis.
(function () {
  var box = document.getElementById('lightbox');
  if (!box) return;
  var imgEl = document.getElementById('lightboxImg');
  var capEl = document.getElementById('lightboxCaption');
  var closeBtn = document.getElementById('lightboxClose');
  var lastTrigger = null; // elemen yang membuka lightbox, buat kembalikan fokus saat tutup

  function open(src, caption, trigger) {
    imgEl.src = src;
    imgEl.alt = caption || '';
    capEl.textContent = caption || '';
    capEl.style.display = caption ? 'block' : 'none';
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    lastTrigger = trigger || null;
    closeBtn.focus(); // pindahkan fokus ke dalam dialog untuk pengguna keyboard/pembaca layar
  }
  function close() {
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    imgEl.src = '';
    if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus(); // kembalikan fokus ke pemicu
    lastTrigger = null;
  }

  // Ambil <img> + keterangan dari kontainer galeri/foto lalu buka lightbox-nya.
  // Dipakai bersama oleh klik mouse dan aktivasi keyboard (Enter/Space).
  function activate(container) {
    var img = container.querySelector('img');
    if (!img) return false; // masih placeholder, belum ada foto
    var cap = '';
    if (container.classList.contains('gallery-item')) {
      var span = container.querySelector('.gallery-overlay span');
      if (span && span.textContent && span.textContent.trim() !== 'Lihat') cap = span.textContent.trim();
    }
    if (!cap && img.alt && img.alt !== 'RR Hair Care') cap = img.alt;
    open(img.src, cap, container);
    return true;
  }

  // Delegasi klik: klik kontainer galeri/foto (overlay galeri menutupi <img>,
  // jadi target klik bisa overlay — ambil <img> dari kontainernya).
  document.addEventListener('click', function (e) {
    var container = e.target.closest && e.target.closest('.gallery-item, .about-img-wrapper');
    if (!container) return;
    if (activate(container)) e.preventDefault();
  });

  // Aktivasi via keyboard: hanya kontainer yang benar-benar bisa difokus
  // (tabindex disetel oleh gallery.js begitu foto asli terpasang) yang merespons.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var container = e.target.closest && e.target.closest('.gallery-item, .about-img-wrapper');
    if (!container || container.getAttribute('tabindex') === null) return;
    e.preventDefault();
    activate(container);
  });

  closeBtn.addEventListener('click', close);
  box.addEventListener('click', function (e) { if (e.target === box) close(); }); // klik latar
})();
