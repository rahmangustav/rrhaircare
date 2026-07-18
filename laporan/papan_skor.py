#!/usr/bin/env python3
"""Papan skor mingguan RR Hair Care — satu corong utuh, tiga sumber data.

MASALAH YANG DIPECAHKAN: angka Instagram, YouTube, dan analitik toko hidup di
tiga tempat terpisah, jadi tidak ada seorang pun bisa melihat rantai lengkapnya:

    konten (IG/YouTube)  →  kunjungan situs  →  KLIK BOOKING WHATSAPP

Padahal cuma bintang utara terakhir itu yang membayar tagihan salon. Tanpa
disatukan, gampang sekali merayakan "jangkauan naik" sambil booking tetap nol —
persis yang terjadi 18 Jul 2026.

Ketiga kredensialnya hanya ada di mesin ini (token Meta di ~/.claude.json,
OAuth Google di google/token.json, Netlify CLI terautentikasi), jadi laporan
ini memang tidak bisa dibuat dari mana pun selain di sini.

Pakai:
    python3 papan_skor.py              # laporan minggu ini
    python3 papan_skor.py --banding    # + bandingkan dengan snapshot terakhir

Hanya MEMBACA. Tidak memposting, tidak mengubah apa pun. Token tidak pernah
dicetak ke layar maupun ke snapshot.
"""
import json
import os
import statistics
import subprocess
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(ROOT)
DATA_DIR = os.path.join(ROOT, "data")
WIB = timezone(timedelta(hours=7))
IG_ID = "17841400394773966"
GRAPH = "https://graph.facebook.com/v25.0"


# ─────────────────────────── Instagram ───────────────────────────
def ig_token() -> str:
    """Token dibaca dari config MCP saat jalan — tak pernah disimpan/dicetak."""
    with open(os.path.expanduser("~/.claude.json")) as f:
        return json.load(f)["mcpServers"]["meta-instagram"]["env"]["INSTAGRAM_ACCESS_TOKEN"]


def ig_get(token: str, path: str, **params):
    params["access_token"] = token
    url = f"{GRAPH}/{path}?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.load(r)


def data_instagram() -> dict:
    tok = ig_token()
    prof = ig_get(tok, IG_ID, fields="followers_count,media_count,website")
    media = ig_get(tok, f"{IG_ID}/media",
                   fields="id,timestamp,media_product_type,like_count,comments_count",
                   limit=40)["data"]

    sekarang = datetime.now(timezone.utc)
    jangkauan, reel_7hari = [], 0
    for m in media:
        ts = datetime.fromisoformat(m["timestamp"].replace("+0000", "+00:00"))
        umur_jam = (sekarang - ts).total_seconds() / 3600
        # Post <24 jam jangkauannya belum matang — ikut menghitungnya membuat
        # angka mingguan terlihat anjlok padahal cuma belum selesai menyebar.
        if umur_jam < 24:
            if umur_jam < 168 and m.get("media_product_type") == "REELS":
                reel_7hari += 1
            continue
        if umur_jam < 168:
            reel_7hari += 1 if m.get("media_product_type") == "REELS" else 0
        try:
            ins = ig_get(tok, f"{m['id']}/insights", metric="reach")["data"]
            nilai = ins[0]["values"][0]["value"] if ins else 0
            if nilai:
                jangkauan.append(nilai)
        except Exception:
            continue

    # Link bio = SATU-SATUNYA jalan klik dari Instagram ke situs. Kalau kosong,
    # semua caption "booking di bawah 👇" menuntun ke tempat yang tidak ada, dan
    # kegagalan itu TIDAK KELIHATAN di metrik mana pun — jangkauan tetap terlihat
    # sehat sementara tak seorang pun bisa sampai ke booking. Karena itu diperiksa
    # tiap pekan, bukan sekali lalu dilupakan.
    link = (prof.get("website") or "").strip()

    return {
        "link_bio": link,
        "link_bio_ada": bool(link),
        "link_bio_beratribusi": "src=ig" in link,
        "follower": prof.get("followers_count"),
        "total_media": prof.get("media_count"),
        "jangkauan_median": int(statistics.median(jangkauan)) if jangkauan else 0,
        "jangkauan_maks": max(jangkauan) if jangkauan else 0,
        "post_terukur": len(jangkauan),
        "reel_7_hari": reel_7hari,
    }


# ─────────────────────────── YouTube ───────────────────────────
def data_youtube() -> dict:
    """Butuh google-auth + googleapiclient; venv rr-haircare-shop sudah tiada,
    jadi pemanggil biasanya memakai ~/moovon-finance/.venv/bin/python."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    token_file = os.path.join(REPO, "google", "token.json")
    c = Credentials.from_authorized_user_file(token_file)
    if c.expired and c.refresh_token:
        c.refresh(Request())
        with open(token_file, "w") as f:
            f.write(c.to_json())
    yt = build("youtube", "v3", credentials=c)

    ch = yt.channels().list(part="statistics,contentDetails", mine=True).execute()["items"][0]
    st = ch["statistics"]
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]

    ids, token = [], None
    while True:
        r = yt.playlistItems().list(playlistId=uploads, part="contentDetails",
                                    maxResults=50, pageToken=token).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        token = r.get("nextPageToken")
        if not token:
            break

    vids = []
    for i in range(0, len(ids), 50):
        vids += yt.videos().list(id=",".join(ids[i:i + 50]),
                                 part="snippet,status,statistics").execute()["items"]

    pub = [v for v in vids if v["status"]["privacyStatus"] == "public"]
    batas = datetime.now(timezone.utc) - timedelta(days=7)
    baru = [v for v in pub
            if datetime.fromisoformat(v["snippet"]["publishedAt"].replace("Z", "+00:00")) > batas]
    views_baru = sum(int(v["statistics"].get("viewCount", 0)) for v in baru)
    tanpa_atribusi = [v for v in pub if "src=yt" not in v["snippet"].get("description", "")]

    return {
        "subscriber": int(st.get("subscriberCount", 0)),
        "views_total": int(st.get("viewCount", 0)),
        "video_publik": len(pub),
        "video_7_hari": len(baru),
        "views_video_7_hari": views_baru,
        "tanpa_atribusi": len(tanpa_atribusi),
    }


# ─────────────────────────── Analitik toko ───────────────────────────
def data_toko() -> dict:
    """Baca blob produksi lewat Netlify CLI (read-only)."""
    cli = os.path.join(REPO, "node_modules", ".bin", "netlify")
    out = subprocess.run([cli, "blobs:get", "stats", "analytics"],
                         cwd=REPO, capture_output=True, text=True, timeout=120)
    if out.returncode != 0:
        raise RuntimeError(f"netlify blobs:get gagal: {out.stderr.strip()[:200]}")
    d = json.loads(out.stdout)

    goals = d.get("goals", {}) or {}
    # lamaran_kerja SENGAJA tidak dijumlahkan — kalau digabung, angka bookingnya
    # bohong. Orang melamar kerja bukan pelanggan yang membeli.
    BOOKING = ("booking_form", "booking_chat")
    klik_booking = sum(g.get("total", 0) for n, g in goals.items() if n in BOOKING)
    uji = sum(v for n, g in goals.items() if n in BOOKING
              for k, v in (g.get("sources") or {}).items() if k.startswith("Uji_"))

    return {
        "tayangan": d.get("total", {}).get("views", 0),
        "pengunjung": d.get("total", {}).get("visitors", 0),
        "sumber": {k: v.get("total", 0) for k, v in (d.get("sources") or {}).items()},
        "halaman": d.get("pages", {}),
        "klik_booking": klik_booking,
        "klik_booking_uji": uji,
        "klik_booking_asli": klik_booking - uji,
        "lamaran_kerja": goals.get("lamaran_kerja", {}).get("total", 0),
        "pesanan_toko": goals.get("pesanan_toko", {}).get("total", 0),
    }


# ─────────────────────────── Laporan ───────────────────────────
def rb(n: int) -> str:
    """Pemisah ribuan gaya Indonesia: 89486 → 89.486."""
    return f"{n:,}".replace(",", ".")


def garis(judul: str) -> None:
    print(f"\n{judul}\n" + "─" * 74)


def cetak(s: dict) -> None:
    print("=" * 74)
    print(f"  PAPAN SKOR RR HAIR CARE — {datetime.now(WIB):%d %B %Y, %H:%M WIB}")
    print("=" * 74)

    t = s.get("toko") or {}
    garis("🎯 BINTANG UTARA — klik booking WhatsApp")
    if t:
        asli = t["klik_booking_asli"]
        print(f"  Klik booking ASLI            : {asli}")
        if t["klik_booking_uji"]:
            print(f"  (data uji, dikurangkan)      : {t['klik_booking_uji']}")
        print(f"  Pesanan toko                 : {t['pesanan_toko']}")
        print(f"  Lamaran kerja (BUKAN booking): {t['lamaran_kerja']}")
        if asli == 0:
            print("  ⚠️  NOL. Semua angka di bawah ini belum berubah jadi pelanggan.")
    else:
        print("  (gagal dibaca)")

    garis("🌐 SITUS — apakah konten mengirim orang?")
    if t:
        print(f"  Tayangan {t['tayangan']:>5} | Pengunjung {t['pengunjung']:>5}")
        for nama, n in sorted(t["sumber"].items(), key=lambda kv: -kv[1]):
            print(f"    {nama:<12} {n:>4}")
        if t["halaman"]:
            jalur = "  →  ".join(f"{k} {v}" for k, v in
                                 sorted(t["halaman"].items(), key=lambda kv: -kv[1]))
            print(f"  Corong halaman: {jalur}")

    y = s.get("youtube") or {}
    garis("📺 YOUTUBE")
    if y:
        # Pemisah ribuan gaya Indonesia. Ganti angkanya saja — pernah salah
        # karena .replace(",", ".") ikut memakan koma di kalimatnya sendiri.
        print(f"  {y['subscriber']} subscriber · {rb(y['views_total'])} views · "
              f"{y['video_publik']} video publik")
        print(f"  7 hari terakhir: {y['video_7_hari']} video baru, "
              f"{rb(y['views_video_7_hari'])} views")
        tanda = "✅ nol celah" if y["tanpa_atribusi"] == 0 else f"⚠️  {y['tanpa_atribusi']} video"
        print(f"  Tanpa atribusi ?src=yt: {tanda}")
    else:
        print("  (gagal dibaca)")

    i = s.get("instagram") or {}
    garis("📷 INSTAGRAM")
    if i:
        print(f"  {i['follower']} follower · {i['total_media']} media")
        print(f"  Jangkauan median {i['jangkauan_median']} (maks {i['jangkauan_maks']}) "
              f"dari {i['post_terukur']} post matang")
        print(f"  Reel 7 hari terakhir: {i['reel_7_hari']}")
        if i["follower"] and i["jangkauan_median"]:
            pct = i["jangkauan_median"] / i["follower"] * 100
            print(f"  Jangkauan median = {pct:.1f}% dari follower sendiri")
        if not i.get("link_bio_ada"):
            print("  🚨 LINK BIO KOSONG — tidak ada jalan klik dari Instagram ke situs.")
            print("     Caption 'booking di bawah 👇' menuntun ke tempat yang tidak ada.")
            print("     Perbaiki manual (API tak bisa edit profil): isi rrhaircare.id/?src=ig")
        elif not i.get("link_bio_beratribusi"):
            print(f"  ⚠️  Link bio ada tapi tanpa ?src=ig: {i['link_bio']}")
            print("     Kunjungannya akan salah masuk kolom 'Langsung'.")
        else:
            print(f"  ✅ Link bio beratribusi: {i['link_bio']}")
    else:
        print("  (gagal dibaca)")

    # Perbandingan silang: inilah alasan ketiganya disatukan.
    if t and y and i and t["sumber"]:
        garis("⚖️  MANA YANG SEBENARNYA MENGIRIM ORANG")
        yt_n, ig_n = t["sumber"].get("YouTube", 0), t["sumber"].get("Instagram", 0)
        print(f"  YouTube   : {yt_n} pengunjung dari {y['subscriber']} subscriber")
        print(f"  Instagram : {ig_n} pengunjung dari {i['follower']} follower")
        if ig_n and yt_n:
            print(f"  → YouTube mengirim {yt_n / ig_n:.1f}× lebih banyak, "
                  f"padahal pengikutnya {i['follower'] / y['subscriber']:.1f}× lebih sedikit")
        print("  Catatan: kunjungan dari Instagram masih masuk 'Langsung' selama link")
        print("  bio belum diberi ?src=ig — angka Instagram di atas kemungkinan besar")
        print("  TERLALU RENDAH, jangan dipakai menghakimi Instagram.")


def banding(baru: dict, lama: dict) -> None:
    garis(f"📊 BANDING dengan snapshot {lama.get('waktu', '?')[:16]}")
    pasang = [
        ("Klik booking ASLI", "toko", "klik_booking_asli"),
        ("Pengunjung situs", "toko", "pengunjung"),
        ("Subscriber YouTube", "youtube", "subscriber"),
        ("Views YouTube", "youtube", "views_total"),
        ("Follower Instagram", "instagram", "follower"),
        ("Jangkauan median IG", "instagram", "jangkauan_median"),
    ]
    for label, grup, kunci in pasang:
        b = (baru.get(grup) or {}).get(kunci)
        l = (lama.get(grup) or {}).get(kunci)
        if b is None or l is None:
            continue
        d = b - l
        arah = f"naik {d}" if d > 0 else (f"TURUN {abs(d)}" if d < 0 else "tetap")
        print(f"  {label:<22} {l:>8} → {b:>8}  ({arah})")


def main() -> None:
    snap = {"waktu": datetime.now(WIB).isoformat()}
    for nama, fn in (("toko", data_toko), ("youtube", data_youtube), ("instagram", data_instagram)):
        try:
            snap[nama] = fn()
        except Exception as e:
            snap[nama] = None
            print(f"⚠️  GAGAL baca {nama}: {type(e).__name__}: {str(e)[:160]}", file=sys.stderr)

    cetak(snap)

    os.makedirs(DATA_DIR, exist_ok=True)
    if "--banding" in sys.argv:
        lama = sorted(f for f in os.listdir(DATA_DIR) if f.startswith("skor_"))
        if lama:
            with open(os.path.join(DATA_DIR, lama[-1])) as f:
                banding(snap, json.load(f))
        else:
            print("\n(Belum ada snapshot lama untuk dibandingkan.)")

    nama = f"skor_{datetime.now(WIB):%Y%m%d_%H%M}.json"
    with open(os.path.join(DATA_DIR, nama), "w") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(f"\nSnapshot: laporan/data/{nama}")


if __name__ == "__main__":
    main()
