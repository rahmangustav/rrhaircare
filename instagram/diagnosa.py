#!/usr/bin/env python3
"""Diagnosa jangkauan Instagram: APA yang menggerakkan jangkauan, bukan sekadar berapa.

Bedanya dengan lapor_ig.py: lapor_ig.py melaporkan angka per post. Skrip ini
menguji dugaan — mana yang benar-benar menentukan jangkauan (mutu hook?
frekuensi posting? format? jam tayang?) — supaya keputusan konten berdasar
bukti, bukan firasat.

Dua hal yang membuat kesimpulan gampang salah, dan ditangani di sini:

1. UMUR POST. Post yang baru tayang beberapa jam jangkauannya belum penuh.
   Kalau ikut dihitung, akan tampak seolah jangkauan sedang anjlok padahal
   cuma belum matang. Default: hanya post >=24 jam.

2. FORMAT TERCAMPUR. Foto jangkauannya jauh di bawah Reel. Hari yang kebetulan
   banyak fotonya akan terlihat seperti "hari buruk" walau Reel-nya biasa saja.
   Karena itu korelasi dihitung pada Reel saja.

Pakai:
    python3 instagram/diagnosa.py                 # snapshot terbaru
    python3 instagram/diagnosa.py --file X.json   # snapshot tertentu
    python3 instagram/diagnosa.py --umur-min 48   # syarat matang lebih ketat
"""
import argparse
import json
import statistics as st
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DATA = Path(__file__).parent / 'data'
# Di bawah jumlah ini, korelasi tidak layak dipercaya — lebih baik diam
# daripada memberi arahan konten dari kebetulan statistik.
MIN_SAMPEL = 8


def muat(berkas=None):
    if berkas:
        p = Path(berkas)
        if not p.exists():
            raise SystemExit(f"Snapshot tidak ditemukan: {p}")
    else:
        snap = sorted(DATA.glob('ig_*.json'))
        if not snap:
            raise SystemExit(f"Tidak ada snapshot di {DATA}. Jalankan lapor_ig.py dulu.")
        p = snap[-1]
    return p, json.loads(p.read_text())


def waktu(m):
    return datetime.strptime(m['tanggal'][:16], '%Y-%m-%d %H:%M')


def peringkat(nilai):
    """Peringkat 1..n; nilai kembar diberi peringkat rata-rata."""
    urut = sorted(range(len(nilai)), key=lambda i: nilai[i])
    hasil = [0.0] * len(nilai)
    i = 0
    while i < len(urut):
        j = i
        while j + 1 < len(urut) and nilai[urut[j + 1]] == nilai[urut[i]]:
            j += 1
        rata = (i + j) / 2 + 1
        for k in range(i, j + 1):
            hasil[urut[k]] = rata
        i = j + 1
    return hasil


def spearman(a, b):
    """Korelasi peringkat. Dipakai karena jangkauan sangat miring — satu post
    viral akan mendominasi korelasi biasa dan menyesatkan."""
    if len(a) < 3:
        return None
    ra, rb = peringkat(a), peringkat(b)
    ma, mb = st.mean(ra), st.mean(rb)
    atas = sum((ra[i] - ma) * (rb[i] - mb) for i in range(len(a)))
    bawah = (sum((x - ma) ** 2 for x in ra) * sum((x - mb) ** 2 for x in rb)) ** 0.5
    return atas / bawah if bawah else None


def kuat(r):
    if r is None:
        return "sampel terlalu sedikit"
    a = abs(r)
    if a >= 0.6:
        return "KUAT"
    if a >= 0.35:
        return "sedang"
    if a >= 0.2:
        return "lemah"
    return "praktis nol"


def belah(posts, kunci, nama_kecil, nama_besar, kesimpulan):
    """Bandingkan jangkauan median separuh terendah vs tertinggi menurut `kunci`.

    `kesimpulan` dipanggil dengan selisih persen agar tiap pemakaian bisa
    menjelaskan arahnya sendiri — angka telanjang gampang dibaca terbalik.
    """
    urut = sorted(posts, key=kunci)
    sep = len(urut) // 2
    bawah, atas = urut[:sep], urut[sep:]
    if not bawah or not atas:
        return
    mb = st.median([m['reach'] for m in bawah])
    ma = st.median([m['reach'] for m in atas])
    print(f"    {nama_kecil}: jangkauan median {mb:5.0f} (n={len(bawah)})")
    print(f"    {nama_besar}: jangkauan median {ma:5.0f} (n={len(atas)})")
    if mb:
        print(f"    → {kesimpulan((ma - mb) / mb * 100)}")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--file', help='snapshot JSON tertentu (default: terbaru)')
    ap.add_argument('--umur-min', type=float, default=24,
                    help='umur minimal post dalam jam agar dianggap matang (default 24)')
    args = ap.parse_args()

    berkas, d = muat(args.file)
    media = d['media']
    # Patokan waktu = saat snapshot diambil, bukan saat skrip dijalankan.
    # Kalau pakai waktu sekarang, snapshot lama akan salah dinilai umurnya.
    sekarang = datetime.strptime(d['dibuat'][:16], '%Y-%m-%d %H:%M') \
        if 'dibuat' in d else datetime.now()

    matang, muda = [], []
    for m in media:
        (matang if (sekarang - waktu(m)).total_seconds() / 3600 >= args.umur_min
         else muda).append(m)

    print("=" * 74)
    print(f"DIAGNOSA JANGKAUAN — {berkas.name}")
    print(f"Snapshot diambil {d.get('dibuat', '?')[:16]} · patokan matang >= {args.umur_min:.0f} jam")
    print("=" * 74)
    print(f"Post dipakai: {len(matang)} matang · {len(muda)} dikecualikan karena masih muda")
    if muda:
        print("  (dikecualikan: " + ", ".join(m['tanggal'][5:16] for m in sorted(muda, key=waktu)) + ")")

    if len(matang) < 3:
        raise SystemExit("\nPost matang terlalu sedikit untuk didiagnosa.")

    # ── Format ──
    print("\n1. FORMAT — Reel vs Foto")
    for jenis in ('Reel', 'Foto'):
        g = [m for m in matang if m['jenis'] == jenis]
        if g:
            print(f"    {jenis}: n={len(g):2d}  jangkauan median {st.median([m['reach'] for m in g]):5.0f}"
                  f"  total like {sum(m['likes'] for m in g):4d}")
    reels_all = [m for m in matang if m['jenis'] == 'Reel']
    fotos = [m for m in matang if m['jenis'] == 'Foto']
    if reels_all and fotos:
        mr, mf = st.median([m['reach'] for m in reels_all]), st.median([m['reach'] for m in fotos])
        if mr:
            print(f"    → Foto mendapat {mf / mr * 100:.0f}% jangkauan Reel."
                  f" Tiap slot yang dipakai foto = kehilangan ~{mr - mf:.0f} jangkauan.")

    # ── Korelasi, Reel saja ──
    reels = [m for m in reels_all if m.get('skip')]
    print(f"\n2. APA YANG MENGGERAKKAN JANGKAUAN? (Reel matang, n={len(reels)})")
    if len(reels) < MIN_SAMPEL:
        print(f"    Sampel di bawah {MIN_SAMPEL} — korelasi tidak ditampilkan supaya tidak menyesatkan.")
    else:
        per_hari = defaultdict(list)
        for m in matang:
            per_hari[m['tanggal'][:10]].append(m)
        for m in reels:
            hari = sorted(per_hari[m['tanggal'][:10]], key=waktu)
            m['_n_hari'] = len(hari)
            m['_slot'] = hari.index(m) + 1
            m['_jam'] = waktu(m).hour

        reach = [m['reach'] for m in reels]
        faktor = [
            ('mutu hook (skip 3 detik)', [m['skip'] for m in reels],
             'negatif = makin sedikit yang kabur, makin luas jangkauan'),
            ('jumlah post di hari itu', [m['_n_hari'] for m in reels],
             'negatif = makin sering posting, jangkauan makin turun'),
            ('urutan post dalam sehari', [m['_slot'] for m in reels],
             'negatif = post kedua/ketiga lebih rugi'),
            ('jam tayang', [m['_jam'] for m in reels],
             'positif = makin malam makin luas, negatif = makin pagi makin luas'),
        ]
        for nama, nilai, arti in faktor:
            r = spearman(nilai, reach)
            tampil = f"{r:+.2f}" if r is not None else "  — "
            print(f"    {nama:26s} {tampil}  [{kuat(r)}]")
            print(f"      {arti}")

        print("\n   Belah dua menurut mutu hook:")
        belah(reels, lambda m: m['skip'], 'hook TERBAIK ', 'hook TERBURUK',
              lambda s: f"hook buruk kehilangan {abs(s):.0f}% jangkauan"
                        if s < 0 else f"hook buruk justru {s:.0f}% lebih luas — periksa lagi")
        print("\n   Belah dua menurut frekuensi hari itu:")
        belah(reels, lambda m: m['_n_hari'], 'hari sepi post', 'hari ramai post',
              lambda s: f"hari ramai post {s:+.0f}% — "
                        + ("posting sering TIDAK menekan jangkauan" if s > -10
                           else "posting sering menekan jangkauan"))

    # ── Sinyal peringkat ──
    print("\n3. SINYAL PERINGKAT (simpan & bagikan — bobotnya paling besar)")
    s = sum(m['saved'] for m in media)
    b = sum(m['shares'] for m in media)
    k = sum(m['comments'] for m in media)
    ada = sum(1 for m in media if m['saved'] or m['shares'])
    print(f"    {len(media)} post → simpan {s} · bagikan {b} · komentar {k}")
    print(f"    post yang dapat minimal 1 simpan/bagikan: {ada} dari {len(media)}")
    if ada <= max(2, len(media) * 0.1):
        print("    → Nyaris tidak ada yang menyimpan/membagikan. Ini sinyal terkuat")
        print("      buat Instagram, dan akun ini praktis tidak mengirimkannya.")

    # ── Pemenang ──
    juara = max(matang, key=lambda m: m['reach'])
    print("\n4. PEMENANG — patokan yang harus ditiru")
    print(f"    {juara['tanggal'][:16]} · jangkauan {juara['reach']} · "
          f"{juara['jenis']} · skip {juara.get('skip', 0):.1f}% · like {juara['likes']}")
    print(f"    {(juara['judul'] or '(tanpa caption)')[:64]}")
    lain = [m['reach'] for m in matang if m is not juara]
    if lain:
        print(f"    = {juara['reach'] / st.median(lain):.1f}x jangkauan median post lainnya")


if __name__ == '__main__':
    main()
