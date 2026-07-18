"""Paket A — perbaikan massal metadata channel YouTube RR Hair Care.

Uji dulu (tanpa mengubah apa pun):   .venv/bin/python jalankan_paket_a.py
Eksekusi sungguhan:                  .venv/bin/python jalankan_paket_a.py --apply

Yang dilakukan (disetujui user 15 Jul 2026):
1. Tambah blok deskripsi standar (booking/harga/WA/hashtag) ke semua video publik
   yang belum punya (penanda idempoten: 'rrhaircare.id').
2. Ganti judul 14 video "tanggal" dengan judul layanan+hasil (dari thumbnail).
3. Matikan selfDeclaredMadeForKids di video yang keliru ditandai untuk anak.
4. Set defaultAudioLanguage='id' untuk yang belum.
5. Private-kan 3 video off-niche + playlist "Claude Ai"/"Musik"/"Family".
6. Perbarui deskripsi & keywords channel.

Kuota: ±6.800 unit dari 10.000/hari. Backup metadata asli = data/audit_20260715.json.
Basis update = data SEGAR dari API (bukan snapshot), supaya tak menimpa perubahan lain.
"""
import json
import re
import sys
import time
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

APPLY = "--apply" in sys.argv
ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"

MARKER = "rrhaircare.id"
DESC_BLOK = """

━━━━━━━━━━━━━━━
RR HAIR CARE — Salon & Perawatan Rambut
📍 Jl. B Raya No.6, Rawabadak Utara, Koja, Jakarta Utara
🕘 Buka Setiap Hari, 09.00–21.00 WIB

🌐 Booking & info: https://rrhaircare.id
💰 Daftar harga lengkap: https://rrhaircare.id/#harga
📲 WhatsApp: https://wa.me/6281386291552

#RRHairCare #SalonJakartaUtara #PerawatanRambut"""

JUDUL_BARU = {
    "3K2j8OAORDc": "Awali Pagi dengan Hair Treatment — Yuk Reservasi di RR Hair Care",
    "X4pDJEIvdg0": "Keseruan Event Matrix Chocolate Factory — Tren Warna Cokelat 2026",
    "_06aRyGOjQA": "Hasil Coloring Biru Navy + Curly, Cantik Banget!",
    "yIkliHnCFLk": "Coloring Red Brown + Smoothing — Halus dan Berkilau",
    "JuMJvViGDwI": "Transformasi Warna Blonde — Rambut Panjang Makin Berkilau",
    "ImtjCIhpZUU": "Hidden Color Hijau Emerald — Warna Unik Anti Mainstream",
    "ZHIOsxRd4Ls": "Suasana RR Hair Care Lagi Rame — Makasih Pelanggan Setia!",
    "cY5QaTcmlnw": "Hasil Coloring Deep Blue + Wave ala RR Hair Care",
    "EoYkIJZL2PA": "Proses Perawatan Rambut Blonde — Telaten Sampai Hasil Maksimal",
    "WsVQ202wU-A": "Produk Baru: CBD Cica+Vit Hair Mask untuk Kulit Kepala Sehat",
    "YZvng-q_4v8": "Serunya Creambath di RR Hair Care — Rileks Maksimal",
    "QcWZqstIdsA": "Proses Smoothing Keratin Bareng Trainer Inaura",
    "27MV1i6GjaQ": "Hasil Coloring Copper Orange — Berani Tampil Beda",
    "uS9cSgEz2VA": "Proses Perawatan Rambut di RR Hair Care — Tahap demi Tahap",
}

OFF_NICHE_JUDUL = {"Ready For Rent", "Live Stream Rumah Musikku", "Streaming Chrome"}
PLAYLIST_PRIVATE = {"Claude Ai", "Musik", "Family"}

KANAL_DESC_TAMBAHAN = """

📍 Alamat: Jl. B Raya No.6, RT.8/RW.5, Rawabadak Utara, Koja, Jakarta Utara 14230
🕘 Jam buka: Setiap Hari, 09.00–21.00 WIB
🌐 Booking & daftar harga: https://rrhaircare.id
📲 WhatsApp: https://wa.me/6281386291552"""
KANAL_KEYWORDS = ('"rr hair care" salon "salon jakarta utara" koja "perawatan rambut" '
                  'smoothing keratin coloring creambath haircut')


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


yt = build("youtube", "v3", credentials=creds())

# ---- ambil data SEGAR semua video publik + info channel ----
# PERHATIAN: daftar id-nya BEKU di snapshot 15 Jul 2026. Metadatanya memang
# diambil segar dari API, tapi video yang terbit SETELAH tanggal itu tidak ada
# di daftar ini sehingga tak pernah tersentuh. Terbukti 18 Jul 2026: dua video
# baru sama sekali tanpa link ke rrhaircare.id. Skrip ini sengaja dibiarkan
# beku karena tugasnya sekali-jalan (retitle + bersih-bersih 15 Jul) dan
# JUDUL_BARU-nya khusus video lama. Untuk perawatan RUTIN video baru, pakai
# `rawat_video_baru.py` yang menarik daftarnya segar dari playlist uploads.
snap = json.load(open(ROOT / "data" / "audit_20260715.json"))
all_ids = [v["id"] for v in snap["videos"]]
fresh = {}
for i in range(0, len(all_ids), 50):
    r = yt.videos().list(id=",".join(all_ids[i:i + 50]), part="snippet,status", maxResults=50).execute()
    for v in r["items"]:
        fresh[v["id"]] = v

pub = {vid: v for vid, v in fresh.items() if v["status"]["privacyStatus"] == "public"}
off_ids = {vid for vid, v in pub.items() if v["snippet"]["title"] in OFF_NICHE_JUDUL}
kids_ids = {vid for vid, v in pub.items() if v["status"].get("selfDeclaredMadeForKids") or v["status"].get("madeForKids")}

print(f"{'MODE UJI (tanpa perubahan)' if not APPLY else '=== MODE APPLY ==='}")
print(f"Video publik: {len(pub)} | off-niche→private: {len(off_ids)} | perbaikan kids: {len(kids_ids)}")

ok, gagal, lewati = [], [], []
for n, (vid, v) in enumerate(sorted(pub.items(), key=lambda kv: kv[1]["snippet"]["publishedAt"]), 1):
    sn, st = v["snippet"], v["status"]
    aksi = []

    if vid in off_ids:
        body = {"id": vid, "status": {
            "privacyStatus": "private",
            "embeddable": st.get("embeddable", True),
            "license": st.get("license", "youtube"),
            "publicStatsViewable": st.get("publicStatsViewable", True),
        }}
        if st.get("selfDeclaredMadeForKids") is not None:
            body["status"]["selfDeclaredMadeForKids"] = st["selfDeclaredMadeForKids"]
        aksi.append("PRIVATE (off-niche)")
        part = "status"
    else:
        snippet_baru = {
            "title": JUDUL_BARU.get(vid, sn["title"]),
            "description": sn.get("description", ""),
            "categoryId": sn["categoryId"],
            "tags": sn.get("tags", []),
            "defaultAudioLanguage": sn.get("defaultAudioLanguage") or "id",
        }
        if sn.get("defaultLanguage"):
            snippet_baru["defaultLanguage"] = sn["defaultLanguage"]
        if vid in JUDUL_BARU and sn["title"] != JUDUL_BARU[vid]:
            aksi.append(f"judul → {JUDUL_BARU[vid][:50]!r}")
        if MARKER not in snippet_baru["description"].lower():
            snippet_baru["description"] = (snippet_baru["description"].rstrip() + DESC_BLOK).strip()
            aksi.append("deskripsi +blok")
        if not sn.get("defaultAudioLanguage"):
            aksi.append("lang=id")
        body = {"id": vid, "snippet": snippet_baru}
        part = "snippet"
        if vid in kids_ids:
            body["status"] = {
                "privacyStatus": st["privacyStatus"],
                "embeddable": st.get("embeddable", True),
                "license": st.get("license", "youtube"),
                "publicStatsViewable": st.get("publicStatsViewable", True),
                "selfDeclaredMadeForKids": False,
            }
            part = "snippet,status"
            aksi.append("bukanUntukAnak")
        if len(snippet_baru["description"]) > 4900:
            gagal.append((vid, "deskripsi >4900 char, dilewati"))
            continue

    if not aksi:
        lewati.append(vid)
        continue

    print(f"[{n:>3}/{len(pub)}] {vid}  {' | '.join(aksi)}")
    if APPLY:
        try:
            yt.videos().update(part=part, body=body).execute()
            ok.append(vid)
            time.sleep(0.15)
        except HttpError as e:
            gagal.append((vid, f"HTTP {e.resp.status}: {e.reason}"))
            print(f"        ❌ {e.resp.status} {e.reason}")

# ---- playlist off-brand → private ----
for p in snap["playlists"]:
    if p["snippet"]["title"] in PLAYLIST_PRIVATE:
        print(f"[playlist] {p['snippet']['title']!r} → private")
        if APPLY:
            try:
                yt.playlists().update(part="snippet,status", body={
                    "id": p["id"],
                    "snippet": {"title": p["snippet"]["title"],
                                "description": p["snippet"].get("description", "")},
                    "status": {"privacyStatus": "private"},
                }).execute()
                ok.append("playlist:" + p["id"])
            except HttpError as e:
                gagal.append((p["snippet"]["title"], f"HTTP {e.resp.status}: {e.reason}"))
                print(f"        ❌ {e.resp.status} {e.reason}")

# ---- deskripsi + keywords channel ----
ch = snap["channel"]
desc_lama = ch["snippet"]["description"]
desc_baru = (desc_lama.rstrip() + KANAL_DESC_TAMBAHAN) if MARKER not in desc_lama.lower() else desc_lama
print(f"[channel] deskripsi +kontak ({len(desc_baru)} char) | keywords → {KANAL_KEYWORDS[:60]}…")
if APPLY:
    try:
        yt.channels().update(part="brandingSettings", body={
            "id": ch["id"],
            "brandingSettings": {"channel": {
                "description": desc_baru,
                "keywords": KANAL_KEYWORDS,
                "country": "ID",
            }},
        }).execute()
        ok.append("channel")
    except HttpError as e:
        gagal.append(("channel", f"HTTP {e.resp.status}: {e.reason}"))
        print(f"        ❌ {e.resp.status} {e.reason}")

print(f"\n{'UJI SELESAI' if not APPLY else 'SELESAI'} — "
      f"{'akan diubah' if not APPLY else 'berhasil'}: {len(ok) if APPLY else 'lihat daftar di atas'}"
      f" | dilewati (sudah rapi): {len(lewati)} | gagal: {len(gagal)}")
for g in gagal:
    print("  ❌", g)
