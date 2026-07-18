#!/usr/bin/env python3
"""Tren Instagram dari waktu ke waktu — akunnya membaik atau memburuk?

Melengkapi dua alat yang sudah ada, tidak menggantikan:
  lapor_ig.py  → memeringkat post (siapa juara minggu ini)
  diagnosa.py  → menguji faktor apa yang menggerakkan jangkauan (korelasi)
  tren.py      → ARAH dari waktu ke waktu (ini)

Pertanyaan yang dijawab: dua bulan terakhir kita naik atau turun, dan apakah
mutu hook ikut bergerak? Itu pertanyaan pertama pemilik usaha, dan sebelum ini
tidak ada alat yang menjawabnya.

DUA PENGAMAN yang wajib ada di alat seperti ini:
1. Post <24 jam DIKECUALIKAN dari semua rata-rata. Jangkauannya belum matang —
   terbukti 18 Jul 2026: tiga Reel diukur pada umur 4-6 jam dapat 115/200/153,
   lalu naik jadi 153/247/165 hanya dalam belasan menit. Ikut menghitungnya
   membuat minggu terbaru selalu tampak anjlok.
2. Hanya Reel yang dibandingkan dengan Reel. Foto cuma ~50% jangkauan Reel,
   jadi hari yang kebetulan banyak fotonya terlihat seperti "hari buruk".

Pakai:
    python3 tren.py              # pakai snapshot terbaru di data/
    python3 tren.py <berkas>     # snapshot tertentu
"""
import glob
import json
import os
import statistics
import sys
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
UMUR_MATANG_JAM = 24


def muat(berkas=None) -> dict:
    if berkas:
        with open(berkas) as f:
            return json.load(f)
    kandidat = sorted(glob.glob(os.path.join(DATA_DIR, "ig_*.json")))
    if not kandidat:
        sys.exit("Belum ada snapshot. Jalankan dulu: python3 lapor_ig.py 45")
    with open(kandidat[-1]) as f:
        return json.load(f)


def siapkan(d: dict) -> tuple:
    dibuat = datetime.strptime(d["dibuat"].replace(" WIB", ""), "%Y-%m-%d %H:%M")
    reels = []
    for m in d["media"]:
        if m.get("jenis") != "Reel":
            continue
        t = datetime.strptime(m["tanggal"], "%Y-%m-%d %H:%M")
        reels.append({**m, "t": t, "umur": (dibuat - t).total_seconds() / 3600})
    reels.sort(key=lambda x: x["t"])
    matang = [r for r in reels if r["umur"] >= UMUR_MATANG_JAM]
    muda = [r for r in reels if r["umur"] < UMUR_MATANG_JAM]
    return dibuat, reels, matang, muda


def med(rows: list, kunci: str):
    nilai = [r[kunci] for r in rows if r.get(kunci)]
    return statistics.median(nilai) if nilai else None


def per_minggu(matang: list) -> None:
    print("\n── PER MINGGU (Reel matang saja) ──")
    print(f"{'pekan mulai':<14}{'n':>3}{'jangkauan med':>15}{'skip med':>11}{'total dibagikan':>17}")
    minggu = {}
    for r in matang:
        awal = r["t"].date().isoformat() if r["t"].weekday() == 0 else None
        senin = r["t"].toordinal() - r["t"].weekday()
        minggu.setdefault(datetime.fromordinal(senin).date().isoformat(), []).append(r)
    for k in sorted(minggu):
        g = minggu[k]
        j, s = med(g, "reach"), med(g, "skip")
        bag = sum(x.get("shares", 0) for x in g)
        print(f"{k:<14}{len(g):>3}{j:>15.0f}{(f'{s:.1f}%' if s else '—'):>11}{bag:>17}")


def dua_periode(matang: list) -> None:
    """Belah tepat di tengah jumlah post, bukan di tengah tanggal — supaya
    kedua sisi punya jumlah sampel yang sebanding."""
    if len(matang) < 8:
        return
    tengah = len(matang) // 2
    lama, baru = matang[:tengah], matang[tengah:]
    print("\n── PARUH LAMA vs PARUH BARU (jumlah post sama banyak) ──")
    for nama, g in (("paruh LAMA", lama), ("paruh BARU", baru)):
        j, s = med(g, "reach"), med(g, "skip")
        print(f"  {nama:<12} {g[0]['tanggal'][:10]} → {g[-1]['tanggal'][:10]}  n={len(g):>2}  "
              f"jangkauan med {j:>5.0f}  skip med {(f'{s:.1f}%' if s else '—')}")
    jl, jb = med(lama, "reach"), med(baru, "reach")
    sl, sb = med(lama, "skip"), med(baru, "skip")
    if jl and jb:
        d = (jb - jl) / jl * 100
        arah = "MEMBAIK" if d > 0 else "MEMBURUK"
        print(f"\n  → Jangkauan {arah}: {jl:.0f} → {jb:.0f} ({d:+.1f}%)")
    if sl and sb:
        # skip KECIL = bagus, jadi turun = membaik
        arah = "MEMBAIK" if sb < sl else "MEMBURUK"
        print(f"  → Mutu hook {arah}: skip {sl:.1f}% → {sb:.1f}% "
              f"({sb - sl:+.1f} poin; makin KECIL makin bagus)")


def pembuka_berulang(reels: list) -> None:
    """Kalimat pembuka yang diulang persis terbukti menggerus jangkauan:
    'LANGSUNG BOOKING SEKARANG DI BAWAH' dipakai berkali-kali dengan jangkauan
    menurun tiap pengulangan. Alat ini menandainya supaya ketahuan sejak awal."""
    kel = {}
    for r in reels:
        judul = (r.get("judul") or "").strip()
        # "(tanpa caption)" itu penanda kosong dari lapor_ig.py, bukan kalimat
        # pembuka yang benar-benar diulang — kalau ikut dihitung ia selalu jadi
        # "temuan" teratas dan menutupi pengulangan yang sungguhan.
        if not judul or judul.lower().startswith("(tanpa"):
            continue
        kunci = judul[:28].upper()
        kel.setdefault(kunci, []).append(r)
    ulang = {k: v for k, v in kel.items() if len(v) >= 3}
    if not ulang:
        return
    print("\n── PEMBUKA CAPTION YANG DIULANG (≥3 kali) ──")
    for k, g in sorted(ulang.items(), key=lambda kv: -len(kv[1])):
        g.sort(key=lambda x: x["t"])
        urut = " → ".join(str(x["reach"]) for x in g)
        muda = sum(1 for x in g if x["umur"] < UMUR_MATANG_JAM)
        catatan = f"  ({muda} masih muda)" if muda else ""
        print(f"  {len(g)}× {k.title()!r}")
        print(f"      jangkauan berurutan: {urut}{catatan}")


def main() -> None:
    d = muat(sys.argv[1] if len(sys.argv) > 1 else None)
    dibuat, reels, matang, muda = siapkan(d)

    print("=" * 74)
    print(f"  TREN INSTAGRAM — snapshot {d['dibuat']}")
    print("=" * 74)
    print(f"Reel {len(reels)} | matang(≥{UMUR_MATANG_JAM}j) {len(matang)} | "
          f"muda {len(muda)} (dikecualikan dari semua rata-rata)")
    if reels:
        print(f"Rentang: {reels[0]['tanggal'][:10]} → {reels[-1]['tanggal'][:10]}")

    if not matang:
        print("\nBelum ada Reel matang untuk dinilai.")
        return

    per_minggu(matang)
    dua_periode(matang)
    pembuka_berulang(reels)

    if muda:
        print("\n── REEL MUDA: hook sudah bisa dibaca, jangkauan BELUM ──")
        print("   (skip rate stabil lebih cepat daripada jangkauan)")
        for r in muda:
            print(f"  {r['tanggal']}  umur {r['umur']:>4.1f}j  skip {r.get('skip', 0):>5.1f}%  "
                  f"jangkauan {r['reach']:>4} (belum final)  {(r.get('judul') or '')[:34]}")
        s_muda = med(muda, "skip")
        s_matang = med(matang, "skip")
        if s_muda and s_matang:
            beda = s_muda - s_matang
            if beda < -5:
                print(f"\n  ✅ Hook post terbaru JAUH LEBIH BAIK: skip {s_muda:.1f}% "
                      f"vs {s_matang:.1f}% biasanya ({beda:+.1f} poin).")
                print("     Kalau pola korelasi hook↔jangkauan bertahan, jangkauan post ini")
                print("     seharusnya mendarat DI ATAS median setelah 24 jam. Cek pekan depan —")
                print("     ini ramalan yang bisa dibuktikan salah, bukan pujian kosong.")
            elif beda > 5:
                print(f"\n  ⚠️  Hook post terbaru lebih buruk: skip {s_muda:.1f}% "
                      f"vs {s_matang:.1f}% biasanya ({beda:+.1f} poin).")


if __name__ == "__main__":
    main()
