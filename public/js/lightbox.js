// Lightbox: klik foto galeri / foto "Tentang Kami" → tampil besar.
// Pakai event delegation supaya jalan untuk foto yang dimuat dinamis.
(function () {
  var box = document.getElementById('lightbox');
  if (!box) return;
  var imgEl = document.getElementById('lightboxImg');
  var capEl = document.getElementById('lightboxCaption');
  var closeBtn = document.getElementById('lightboxClose');

  function open(src, caption) {
    imgEl.src = src;
    imgEl.alt = caption || '';
    capEl.textContent = caption || '';
    capEl.style.display = caption ? 'block' : 'none';
    box.classList.add('open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    box.classList.remove('open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    imgEl.src = '';
  }

  // Delegasi klik: klik kontainer galeri/foto (overlay galeri menutupi <img>,
  // jadi target klik bisa overlay — ambil <img> dari kontainernya).
  document.addEventListener('click', function (e) {
    var container = e.target.closest && e.target.closest('.gallery-item, .about-img-wrapper');
    if (!container) return;
    var img = container.querySelector('img');
    if (!img) return; // masih placeholder, belum ada foto
    e.preventDefault();
    // Ambil keterangan dari overlay galeri kalau ada, kalau tidak dari alt
    var cap = '';
    if (container.classList.contains('gallery-item')) {
      var span = container.querySelector('.gallery-overlay span');
      if (span && span.textContent && span.textContent.trim() !== 'Lihat') cap = span.textContent.trim();
    }
    if (!cap && img.alt && img.alt !== 'RR Hair Care') cap = img.alt;
    open(img.src, cap);
  });

  closeBtn.addEventListener('click', close);
  box.addEventListener('click', function (e) { if (e.target === box) close(); }); // klik latar
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
