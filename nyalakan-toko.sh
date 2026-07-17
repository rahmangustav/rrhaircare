#!/usr/bin/env bash
# Nyalakan Toko RR Hair Care (versi Netlify) di komputer untuk uji coba, lalu buka di browser.
# Aman diklik berkali-kali.
set -u
DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8888
URL="http://localhost:$PORT"
LOG="$DIR/dev.log"

cd "$DIR" || exit 1

# Kalau belum hidup, nyalakan netlify dev (mengemulasi server + penyimpanan di komputer).
if ! curl -s -o /dev/null "$URL" 2>/dev/null; then
  echo "Menyalakan toko (mungkin butuh ~15 detik pertama kali)..."
  setsid ./node_modules/.bin/netlify dev --offline --port "$PORT" > "$LOG" 2>&1 < /dev/null &
  for i in $(seq 1 60); do
    curl -s -o /dev/null "$URL" 2>/dev/null && break
    sleep 1
  done
fi

if curl -s -o /dev/null "$URL" 2>/dev/null; then
  echo "Toko siap di $URL — membuka browser..."
  xdg-open "$URL" >/dev/null 2>&1 &
else
  echo "Gagal menyalakan. Cek log: $LOG"
  tail -n 20 "$LOG" 2>/dev/null
  sleep 5
fi
