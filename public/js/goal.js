// Pencatat klik booking WhatsApp — ukuran paling penting buat salon:
// bukan "berapa orang datang ke situs", tapi "berapa yang akhirnya menghubungi".
//
// PENTING: tidak semua link wa.me itu booking. Empat tombol di bagian Karir
// adalah lamaran kerja; kalau ikut dihitung, angka bookingnya bohong.
// Karena itu tiap link diklasifikasikan dulu, bukan digebyah-uyah.
(function () {
  function entry() {
    try { return JSON.parse(sessionStorage.getItem('rr_entry') || '{}'); }
    catch (e) { return {}; }
  }

  function kirim(name, spot) {
    var e = entry();
    try {
      fetch('/api/goal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name, spot: spot || '', ref: e.ref || '', campaign: e.campaign || '' }),
        keepalive: true, // klik membuka tab WhatsApp — permintaan harus selamat
      }).catch(function () {});
    } catch (err) {}
  }

  // Dipakai kirimBooking() di index.html: form booking terisi lengkap =
  // niat paling tinggi, dihitung terpisah dari sekadar chat.
  window.catatBooking = function () { kirim('booking_form', 'form'); };

  function jenis(a) {
    if (a.closest('.btn-karir')) return 'lamaran_kerja';
    if (location.pathname.indexOf('/checkout') === 0) return 'pesanan_toko';
    return 'booking_chat';
  }

  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href*="wa.me"], a[href*="api.whatsapp.com"]');
    if (!a) return;
    // data-wa menandai tombol mana persisnya; kalau tombol baru lupa diberi
    // atribut, klik tetap tercatat — hanya pecahan per tombolnya yang kosong.
    kirim(jenis(a), a.getAttribute('data-wa') || '');
  }, true); // fase capture: tetap tercatat walau handler lain menghentikan event
})();
