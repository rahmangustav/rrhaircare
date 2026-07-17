#!/usr/bin/env bash
# Matikan Toko RR Hair Care (netlify dev) yang jalan di komputer.
KILLED=0
for p in 8888 3999; do
  PID=$(fuser $p/tcp 2>/dev/null)
  if [ -n "$PID" ]; then kill $PID 2>/dev/null; KILLED=1; fi
done
if [ "$KILLED" = "1" ]; then echo "Toko dimatikan."; else echo "Toko memang tidak sedang jalan."; fi
sleep 2
