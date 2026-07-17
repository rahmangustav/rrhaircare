#!/bin/bash
# Dijalankan cron pada 16 Jul 2026 (tiap jam 14:10-19:10 WIB) untuk menuntaskan
# koreksi jam buka di deskripsi YouTube. Idempoten: begitu output menyebut
# "sisa: 0", entri cron-nya dihapus sendiri. Log: data/koreksi_jam.log
DIR=/home/rr/rr-haircare-shop/google
LOG="$DIR/data/koreksi_jam.log"
out=$("$DIR/.venv/bin/python" "$DIR/betulkan_jam_youtube.py" 2>&1)
{
  echo "=== $(date '+%F %T %Z') ==="
  echo "$out"
} >> "$LOG"
if echo "$out" | grep -q "sisa: 0"; then
  crontab -l 2>/dev/null | grep -v koreksi_jam_cron | crontab -
  echo "TUNTAS — entri cron dibersihkan sendiri" >> "$LOG"
fi
