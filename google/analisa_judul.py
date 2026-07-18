#!/usr/bin/env python3
"""Gaya judul mana yang sebenarnya ditonton? — audit judul YouTube RR Hair Care.

Temuan pertama (19 Jul 2026, 126 video publik berumur >=7 hari):

    deskriptif    n=102  median 394 views  1,37 views/hari
    bergaya jualan n=18  median 178 views  0,51 views/hari   <- 2,2x lebih buruk
    hashtag saja   n= 6  median 302 views  0,86 views/hari

Sejalan dengan pola yang sama di Instagram (caption "LANGSUNG BOOKING/BELI"
berjangkauan jauh di bawah lainnya). Bahasa jualan menekan tontonan di KEDUA
platform — dan itu berlawanan dengan naluri "biar cepat dapat booking".

TIGA JEBAKAN yang sudah dibayar saat membangun ini — jangan diulang:

1. HASHTAG MERUSAK KLASIFIKASI. Versi pertama menandai
   "#salon #haircut #keratintreatment" sebagai judul SEO yang baik, karena kata
   "salon" ada DI DALAM hashtag. Hasilnya kesimpulan terbalik ("judul ber-lokasi
   buruk"). Hashtag WAJIB dibuang dulu sebelum judul dinilai.

2. VIDEO BARU MENYERET MEDIAN. Video <7 hari belum mengumpulkan tontonan;
   dua repost yang baru diunggah (1 view) sempat membuat satu kategori tampak
   hancur. Karena itu ada ambang umur.

3. SEBAB-AKIBAT BISA TERBALIK. Sempat diduga "judul bagus = video yang dulu
   diretitle karena lemah". Diuji: nol dari 18 video kategori teratas berasal
   dari daftar retitle Paket A, jadi dugaan itu gugur. Uji semacam ini wajib
   diulang kalau ada program retitle baru.

BATAS YANG JUJUR: ini korelasi, bukan sebab-akibat, dan n=18 untuk kategori
jualan. Bisa saja konten yang lemah cenderung diberi judul jualan. Cukup kuat
untuk mengubah kebiasaan menulis judul, TIDAK cukup untuk mengklaim
"ganti judul = views naik" — apalagi views video lama nyaris tak bergerak
lagi. Nilainya ada di judul video BARU.

Pakai:
    <venv>/bin/python analisa_judul.py
"""
import re
import statistics
from datetime import datetime, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"
UMUR_MIN_HARI = 7

# Kata yang menandai judul "menjual" alih-alih menceritakan.
PROMO = (
    "promo", "diskon", "hubungi", "booking", "order", "buruan", "cepetan",
    "hemat", "terjangkau", "terbaik", "terpercaya", "wa :", "yuk ke",
    "tempatnya", "harga", "gratis", "murah",
)


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


def tanpa_tagar(judul: str) -> str:
    """Buang hashtag SEBELUM menilai — lihat jebakan #1 di docstring."""
    return re.sub(r"#\S+", "", judul).strip()


def kategori(judul: str) -> str:
    inti = tanpa_tagar(judul)
    if len(inti) < 12:
        return "tagar_saja"
    if any(k in inti.lower() for k in PROMO):
        return "jualan"
    return "deskriptif"


def ambil_video(yt) -> list:
    ch = yt.channels().list(part="contentDetails", mine=True).execute()["items"][0]
    up = ch["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, tok = [], None
    while True:
        r = yt.playlistItems().list(playlistId=up, part="contentDetails",
                                    maxResults=50, pageToken=tok).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        tok = r.get("nextPageToken")
        if not tok:
            break
    out = []
    for i in range(0, len(ids), 50):
        out += yt.videos().list(id=",".join(ids[i:i + 50]),
                                part="snippet,status,statistics").execute()["items"]
    return out


def main() -> None:
    yt = build("youtube", "v3", credentials=creds())
    now = datetime.now(timezone.utc)

    rows, terlalu_baru = [], 0
    for x in ambil_video(yt):
        if x["status"]["privacyStatus"] != "public":
            continue
        terbit = datetime.fromisoformat(x["snippet"]["publishedAt"].replace("Z", "+00:00"))
        umur = (now - terbit).days
        if umur < UMUR_MIN_HARI:
            terlalu_baru += 1
            continue
        judul = x["snippet"]["title"]
        rows.append({
            "id": x["id"], "judul": judul, "umur": umur,
            "views": int(x["statistics"].get("viewCount", 0)),
            "kat": kategori(judul),
        })

    print("=" * 72)
    print("  GAYA JUDUL MANA YANG DITONTON — RR Hair Care")
    print("=" * 72)
    print(f"Video publik dinilai: {len(rows)}  "
          f"(dikecualikan {terlalu_baru} video <{UMUR_MIN_HARI} hari, belum matang)")

    print(f"\n{'gaya judul':<14}{'n':>4}{'median views':>14}{'views/hari':>13}")
    ringkas = {}
    for k in ("deskriptif", "jualan", "tagar_saja"):
        g = [r for r in rows if r["kat"] == k]
        if not g:
            continue
        mv = statistics.median([r["views"] for r in g])
        vh = statistics.median([r["views"] / max(r["umur"], 1) for r in g])
        ringkas[k] = mv
        print(f"{k:<14}{len(g):>4}{mv:>14.0f}{vh:>13.2f}")

    if "deskriptif" in ringkas and "jualan" in ringkas and ringkas["jualan"]:
        rasio = ringkas["deskriptif"] / ringkas["jualan"]
        print(f"\n  → Judul deskriptif {rasio:.1f}x lebih banyak ditonton "
              f"daripada judul bergaya jualan.")
        print("    Korelasi, bukan sebab-akibat — tapi cukup untuk berhenti")
        print("    menulis judul jualan pada video BARU.")

    jualan = sorted([r for r in rows if r["kat"] == "jualan"], key=lambda r: r["views"])
    if jualan:
        print(f"\n── {len(jualan)} judul bergaya jualan, dari yang paling sepi ──")
        for r in jualan[:10]:
            print(f"  {r['views']:>6} views · {r['umur']:>3}h · {r['judul'][:56]}")
        print("\n  Catatan: JANGAN buru-buru retitle video lama — tontonan video")
        print("  lama nyaris tak bergerak lagi, jadi hasilnya sia-sia. Nilai temuan")
        print("  ini ada pada judul video yang BELUM dibuat.")


if __name__ == "__main__":
    main()
