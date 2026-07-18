// Beacon penghitung pengunjung — ringan, tanpa cookie.
// Tiap load = 1 view. "unique" = kunjungan pertama browser ini hari ini (via localStorage).
(function () {
  try {
    var day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // WIB
    var key = 'rr_seen_' + day;
    var unique = false;
    try { unique = !localStorage.getItem(key); if (unique) localStorage.setItem(key, '1'); } catch (e) {}
    var path = location.pathname || '/';
    // Asal kunjungan: ?utm_source= / ?src= kalau ada, kalau tidak dari referrer.
    var campaign = '';
    try {
      var q = new URLSearchParams(location.search);
      campaign = q.get('utm_source') || q.get('src') || '';
    } catch (e) {}
    // Simpan asal MASUK sesi ini supaya goal.js bisa memberi tahu server
    // dari mana orang yang akhirnya klik booking itu datang. Ditulis sekali
    // per sesi; halaman berikutnya tidak menimpanya.
    try {
      if (!sessionStorage.getItem('rr_entry')) {
        sessionStorage.setItem('rr_entry', JSON.stringify({
          ref: document.referrer || '', campaign: campaign,
        }));
      }
    } catch (e) {}
    fetch('/api/hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: path, unique: unique, ref: document.referrer || '', campaign: campaign }),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
})();
