// Isi section #harga dari /api/pricelist, dikelompokkan per kategori.
(function () {
  var wrap = document.getElementById('priceWrap');
  if (!wrap) return;
  var esc = function (s) { return String(s || '').replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rupiah = function (n) { return 'Rp' + (Number(n) || 0).toLocaleString('id-ID'); };
  // Rapikan durasi POS: "1h 50min" → "1 jam 50 mnt"
  var dur = function (d) {
    if (!d) return '';
    return String(d)
      .replace(/(\d+)\s*h/g, '$1 jam')
      .replace(/(\d+)\s*min/g, '$1 mnt')
      .replace(/\s+/g, ' ').trim();
  };
  // Urutan kategori yang diutamakan
  var ORDER = ['Hair Cut', 'Blow & Styling', 'Coloring & Highlight', 'Perm & Rebonding',
    'Hair Spa & Treatment', 'Facial', 'Nail Art', 'Lulur', 'Whitening', 'Paket Layanan', 'Lainnya'];

  fetch('/api/pricelist').then(function (r) { return r.json(); }).then(function (list) {
    if (!Array.isArray(list) || !list.length) {
      wrap.innerHTML = '<p class="price-loading">Daftar harga akan segera hadir.</p>';
      return;
    }
    var groups = {};
    list.forEach(function (it) { (groups[it.category] = groups[it.category] || []).push(it); });
    var cats = Object.keys(groups).sort(function (a, b) {
      var ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      if (ia < 0) ia = 99; if (ib < 0) ib = 99;
      return ia - ib || a.localeCompare(b);
    });
    wrap.innerHTML = cats.map(function (cat) {
      var rows = groups[cat].map(function (it) {
        var d = dur(it.duration);
        var priceHtml = it.promo && it.promo < it.price
          ? '<span class="was">' + rupiah(it.price) + '</span><span class="now">' + rupiah(it.promo) + '</span>'
          : rupiah(it.price);
        return '<div class="price-row">' +
          '<span class="pn">' + esc(it.name) + (d ? ' <span class="pd">· ' + esc(d) + '</span>' : '') + '</span>' +
          '<span class="leader"></span>' +
          '<span class="pp">' + priceHtml + '</span>' +
          '</div>';
      }).join('');
      // Akordeon: kategori tertutup secara default supaya halaman tidak memanjang.
      return '<details class="price-cat">' +
        '<summary><h3>' + esc(cat) + '</h3>' +
        '<span class="pc-count">' + groups[cat].length + ' layanan</span>' +
        '<span class="pc-chev" aria-hidden="true">&#9662;</span></summary>' +
        '<div class="pc-items">' + rows + '</div>' +
        '</details>';
    }).join('');

    // Isi dropdown Layanan di form Booking (nama + harga), kelompok per kategori.
    var sel = document.getElementById('layanan-select');
    if (sel) {
      var opts = '<option value="">-- Pilih Layanan --</option>';
      cats.forEach(function (cat) {
        if (cat === 'Lainnya') return; // add-on kecil, tak perlu di booking
        opts += '<optgroup label="' + esc(cat) + '">';
        groups[cat].forEach(function (it) {
          var harga = (it.promo && it.promo < it.price) ? it.promo : it.price;
          var label = it.name + ' — ' + rupiah(harga);
          opts += '<option value="' + esc(label) + '">' + esc(label) + '</option>';
        });
        opts += '</optgroup>';
      });
      sel.innerHTML = opts;
    }
  }).catch(function () {
    wrap.innerHTML = '<p class="price-loading">Gagal memuat daftar harga.</p>';
  });
})();
