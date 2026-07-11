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

  // Delegasi klik: foto di dalam .gallery-item atau .about-img-wrapper
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('.gallery-item img, .about-img-wrapper img');
    if (!img) return;
    e.preventDefault();
    // Ambil keterangan dari overlay galeri kalau ada, kalau tidak dari alt
    var cap = '';
    var item = img.closest('.gallery-item');
    if (item) {
      var span = item.querySelector('.gallery-overlay span');
      if (span && span.textContent && span.textContent.trim() !== 'Lihat') cap = span.textContent.trim();
    }
    if (!cap && img.alt && img.alt !== 'RR Hair Care') cap = img.alt;
    open(img.src, cap);
  });

  closeBtn.addEventListener('click', close);
  box.addEventListener('click', function (e) { if (e.target === box) close(); }); // klik latar
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
