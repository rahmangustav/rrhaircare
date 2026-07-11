// Beacon penghitung pengunjung — ringan, tanpa cookie.
// Tiap load = 1 view. "unique" = kunjungan pertama browser ini hari ini (via localStorage).
(function () {
  try {
    var day = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10); // WIB
    var key = 'rr_seen_' + day;
    var unique = false;
    try { unique = !localStorage.getItem(key); if (unique) localStorage.setItem(key, '1'); } catch (e) {}
    var path = location.pathname || '/';
    fetch('/api/hit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: path, unique: unique }),
      keepalive: true
    }).catch(function () {});
  } catch (e) {}
})();
