// Isi section #harga dari /api/pricelist. Markup-nya sudah ditanam saat build
// (lihat scripts/prerender.js) supaya terbaca mesin pencari; di browser isinya
// ditimpa dengan data terbaru agar harga yang diubah di admin langsung tampil
// tanpa menunggu deploy berikutnya. Logika render dipakai bersama —
// public/js/pricelist-render.js.
(function () {
  var wrap = document.getElementById('priceWrap');
  if (!wrap) return;
  var R = window.PricelistRender;
  if (!R) return; // modul render gagal dimuat: biarkan versi statis apa adanya

  fetch('/api/pricelist').then(function (r) { return r.json(); }).then(function (list) {
    if (!Array.isArray(list) || !list.length) return; // pertahankan versi statis
    var g = R.kelompokkan(list);
    wrap.innerHTML = R.akordeonHtml(list);

    // Kartu layanan di section atas ikut memakai angka asli: jumlah layanan
    // dan harga termurah per kategori. Sekali harga diubah di admin, teks di
    // kartu ikut berubah — tidak ada angka yang perlu disunting manual.
    document.querySelectorAll('.service-card[data-kategori]').forEach(function (card) {
      var items = g.groups[card.getAttribute('data-kategori')];
      var meta = card.querySelector('.service-meta');
      if (!meta || !items || !items.length) return;
      meta.textContent = R.metaKartu(items);
    });

    // Isi dropdown Layanan di form Booking (nama + harga), kelompok per kategori.
    var sel = document.getElementById('layanan-select');
    if (sel) {
      var opts = '<option value="">-- Pilih Layanan --</option>';
      g.cats.forEach(function (cat) {
        if (cat === 'Lainnya') return; // add-on kecil, tak perlu di booking
        opts += '<optgroup label="' + R.esc(cat) + '">';
        g.groups[cat].forEach(function (it) {
          var label = it.name + ' — ' + R.rupiah(R.hargaEfektif(it));
          opts += '<option value="' + R.esc(label) + '">' + R.esc(label) + '</option>';
        });
        opts += '</optgroup>';
      });
      sel.innerHTML = opts;
    }
  }).catch(function () { /* versi statis tetap tampil */ });
})();
