#!/usr/bin/env python3
"""Siapkan Reel Instagram untuk diunggah ulang ke YouTube Shorts.

KENAPA: konten yang sama dapat tayangan 2,8× lebih banyak di YouTube Shorts
(median, 9 menang dari 11 konten identik) padahal subscriber-nya 4× lebih
sedikit. Per 18 Jul 2026 ada 25 dari 36 Reel yang tak pernah diunggah ke sana —
video sudah jadi, tinggal unggah, tayangannya gratis.

Skrip ini HANYA MENYIAPKAN: unduh video + susun judul & deskripsi.
TIDAK mengunggah apa pun. Upload publik butuh persetujuan pemilik.

Pakai:
    python3 siapkan_repost.py            # daftar saja, tanpa unduh
    python3 siapkan_repost.py --unduh    # unduh video + tulis manifest
"""
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

GRAPH = "https://graph.facebook.com/v25.0"
IG_ID = "17841400394773966"
WIB = timezone(timedelta(hours=7))
ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "repost")
SEJAK = "2026-06-24"

# Blok deskripsi standar kanal YouTube salon — SAMA persis dengan yang dipakai
# jalankan_paket_a.py, termasuk ?src=yt supaya kunjungannya bisa diatribusikan.
BLOK = """

━━━━━━━━━━━━━━━
RR HAIR CARE — Salon & Perawatan Rambut
📍 Jl. B Raya No.6, Rawabadak Utara, Koja, Jakarta Utara
🕘 Buka Setiap Hari, 09.00–21.00 WIB

🌐 Booking & info: https://rrhaircare.id/?src=yt
💰 Daftar harga lengkap: https://rrhaircare.id/?src=yt#harga
📲 WhatsApp: https://wa.me/6281386291552

#RRHairCare #SalonJakartaUtara #PerawatanRambut #Shorts"""

STOP = {'yang', 'di', 'ke', 'dan', 'buat', 'aja', 'banget', 'rr', 'hair', 'care',
        'the', 'untuk', 'dgn', 'pun', 'para', 'jadi', 'biar', 'nih', 'ini', 'itu'}


def token():
    with open(os.path.expanduser("~/.claude.json")) as f:
        return json.load(f)["mcpServers"]["meta-instagram"]["env"]["INSTAGRAM_ACCESS_TOKEN"]


def get(tok, path, **p):
    p["access_token"] = tok
    import urllib.parse
    with urllib.request.urlopen(f"{GRAPH}/{path}?" + urllib.parse.urlencode(p), timeout=60) as r:
        return json.load(r)


def kata(s):
    s = re.sub(r"[^a-z0-9 ]", " ", s.lower())
    return {w for w in s.split() if len(w) > 3 and w not in STOP}


def judul_youtube(cap):
    """Judul dari kalimat pertama caption, dipotong wajar dan dibersihkan."""
    baris = [b.strip() for b in (cap or "").splitlines() if b.strip()]
    t = baris[0] if baris else "RR Hair Care"
    t = re.split(r"(?<=[.!?])\s", t)[0]
    t = re.sub(r"#\w+", "", t)                 # hashtag pindah ke deskripsi
    t = re.sub(r"https?://\S+", "", t)
    t = re.sub(r"\s+", " ", t).strip(" -—·,")
    if len(t) > 90:
        t = t[:87].rsplit(" ", 1)[0] + "…"
    return t or "RR Hair Care — Salon Koja Jakarta Utara"


def main():
    unduh = "--unduh" in sys.argv
    tok = token()

    # Reel Instagram sejak SEJAK
    ig, after = [], None
    while True:
        p = {"fields": "id,caption,media_type,media_url,permalink,timestamp", "limit": 50}
        if after:
            p["after"] = after
        r = get(tok, f"{IG_ID}/media", **p)
        ig += r.get("data", [])
        after = r.get("paging", {}).get("cursors", {}).get("after")
        if not r.get("paging", {}).get("next") or (ig and ig[-1]["timestamp"][:10] < SEJAK):
            break
    reels = [m for m in ig if "/reel/" in m.get("permalink", "") and m["timestamp"][:10] >= SEJAK]

    # Judul Shorts yang sudah ada di YouTube salon
    yt_judul = []
    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build
        gdir = os.path.join(os.path.dirname(ROOT), "google")
        c = Credentials.from_authorized_user_file(os.path.join(gdir, "token.json"))
        y = build("youtube", "v3", credentials=c)
        ch = y.channels().list(part="contentDetails", mine=True).execute()["items"][0]
        up = ch["contentDetails"]["relatedPlaylists"]["uploads"]
        ids, t = [], None
        while True:
            r = y.playlistItems().list(part="contentDetails", playlistId=up,
                                       maxResults=50, pageToken=t).execute()
            ids += [i["contentDetails"]["videoId"] for i in r["items"]]
            t = r.get("nextPageToken")
            if not t:
                break
        for i in range(0, len(ids), 50):
            for v in y.videos().list(part="snippet", id=",".join(ids[i:i + 50])).execute()["items"]:
                yt_judul.append(v["snippet"]["title"])
    except Exception as e:
        sys.exit(f"Gagal baca YouTube (butuh google/token.json): {e}")

    ytk = [kata(j) for j in yt_judul]
    belum = []
    for m in reels:
        ki = kata((m.get("caption") or "")[:120])
        if ki and max((len(ki & k) for k in ytk), default=0) >= 2:
            continue  # sudah ada padanannya
        belum.append(m)

    print(f"Reel sejak {SEJAK}: {len(reels)} | sudah ada di YouTube: {len(reels)-len(belum)} | "
          f"BELUM: {len(belum)}")
    if not unduh:
        for i, m in enumerate(belum, 1):
            print(f"{i:>2}. {m['timestamp'][:10]}  {judul_youtube(m.get('caption'))[:70]}")
        print("\nJalankan dengan --unduh untuk mengunduh video + menyiapkan metadata.")
        return

    os.makedirs(OUT, exist_ok=True)
    manifest = []
    for i, m in enumerate(belum, 1):
        url = m.get("media_url")
        if not url:
            print(f"  [{i}] LEWAT (tanpa media_url) {m['permalink']}")
            continue
        nama = f"{m['timestamp'][:10]}_{m['id']}.mp4"
        path = os.path.join(OUT, nama)
        if not os.path.exists(path):
            urllib.request.urlretrieve(url, path)
        cap = m.get("caption") or ""
        manifest.append({
            "berkas": nama,
            "judul": judul_youtube(cap),
            "deskripsi": (cap.strip() + BLOK) if cap.strip() else BLOK.strip(),
            "asal_instagram": m["permalink"],
            "tanggal_ig": m["timestamp"][:10],
            "ukuran_mb": round(os.path.getsize(path) / 1e6, 1),
        })
        print(f"  [{i}/{len(belum)}] {nama}  {manifest[-1]['ukuran_mb']} MB")

    mp = os.path.join(OUT, "manifest.json")
    with open(mp, "w") as f:
        json.dump({"dibuat": datetime.now(WIB).strftime("%Y-%m-%d %H:%M WIB"),
                   "jumlah": len(manifest), "video": manifest}, f, ensure_ascii=False, indent=1)
    total = sum(x["ukuran_mb"] for x in manifest)
    print(f"\nSiap: {len(manifest)} video ({total:.0f} MB) di instagram/repost/")
    print(f"Metadata: {mp}")
    print("Upload publik BELUM dilakukan — butuh persetujuan pemilik.")


if __name__ == "__main__":
    main()
