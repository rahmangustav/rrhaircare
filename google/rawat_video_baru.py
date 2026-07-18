"""Rawat video YouTube yang baru terbit — pasang blok deskripsi standar.

MASALAH YANG DIPERBAIKI: `jalankan_paket_a.py` mengambil daftar video dari
snapshot BEKU `data/audit_20260715.json` (baris 88). Akibatnya setiap video yang
terbit SETELAH 15 Jul 2026 tak pernah tersentuh — tak dapat alamat salon, tak
dapat link booking, tak dapat `?src=yt`. Terbukti 18 Jul 2026: dua video yang
terbit hari itu sama sekali tak punya jalan menuju rrhaircare.id.

Skrip ini mengambil daftar video SEGAR dari playlist uploads, jadi video baru
selalu ikut terjaring. Idempoten lewat penanda `rrhaircare.id` di deskripsi —
aman dijalankan berulang, mingguan.

Beda dengan Paket A: skrip ini HANYA menyentuh deskripsi + bahasa audio video.
Tidak mengubah judul, tidak menyentuh playlist, tidak menyentuh deskripsi
channel — supaya perawatan rutin tak berisiko menimpa pekerjaan lain.

Jalankan:
  <venv>/bin/python rawat_video_baru.py            # uji, tanpa perubahan
  <venv>/bin/python rawat_video_baru.py --apply    # eksekusi

Kuota: ±50 unit per video yang diperbaiki + ~5 unit untuk daftar. Sangat murah.
"""
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

# Link ber-`?src=yt` sejak awal. Aplikasi YouTube di HP sering tidak mengirim
# referrer, jadi tanpa parameter ini kunjungan dari YouTube salah masuk kolom
# "Langsung" di analitik toko dan jerih payah kontennya tak kelihatan.
DESC_BLOK = """

━━━━━━━━━━━━━━━
RR HAIR CARE — Salon & Perawatan Rambut
📍 Jl. B Raya No.6, Rawabadak Utara, Koja, Jakarta Utara
🕘 Buka Setiap Hari, 09.00–21.00 WIB

🌐 Booking & info: https://rrhaircare.id/?src=yt
💰 Daftar harga lengkap: https://rrhaircare.id/?src=yt#harga
📲 WhatsApp: https://wa.me/6281386291552

#RRHairCare #SalonJakartaUtara #PerawatanRambut"""


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


def id_video_terbaru(yt) -> list:
    """Semua id video dari playlist uploads channel — SEGAR, bukan snapshot."""
    ch = yt.channels().list(part="contentDetails", mine=True).execute()
    uploads = ch["items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    ids, token = [], None
    while True:
        r = yt.playlistItems().list(
            playlistId=uploads, part="contentDetails", maxResults=50, pageToken=token,
        ).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        token = r.get("nextPageToken")
        if not token:
            break
    return ids


def main() -> None:
    yt = build("youtube", "v3", credentials=creds())

    ids = id_video_terbaru(yt)
    fresh = {}
    for i in range(0, len(ids), 50):
        r = yt.videos().list(
            id=",".join(ids[i:i + 50]), part="snippet,status", maxResults=50,
        ).execute()
        for v in r["items"]:
            fresh[v["id"]] = v

    pub = {vid: v for vid, v in fresh.items() if v["status"]["privacyStatus"] == "public"}
    print("MODE UJI (tanpa perubahan)" if not APPLY else "=== MODE APPLY ===")
    print(f"Total video: {len(fresh)} | publik: {len(pub)}")

    ok, gagal, rapi = [], [], 0
    for vid, v in sorted(pub.items(), key=lambda kv: kv[1]["snippet"]["publishedAt"]):
        sn = v["snippet"]
        aksi = []
        desc = sn.get("description", "")

        snippet_baru = {
            "title": sn["title"],
            "description": desc,
            "categoryId": sn["categoryId"],
            "tags": sn.get("tags", []),
            "defaultAudioLanguage": sn.get("defaultAudioLanguage") or "id",
        }
        if sn.get("defaultLanguage"):
            snippet_baru["defaultLanguage"] = sn["defaultLanguage"]

        if MARKER not in desc.lower():
            snippet_baru["description"] = (desc.rstrip() + DESC_BLOK).strip()
            aksi.append("deskripsi +blok")
        if not sn.get("defaultAudioLanguage"):
            aksi.append("lang=id")

        if not aksi:
            rapi += 1
            continue
        if len(snippet_baru["description"]) > 4900:
            gagal.append((vid, "deskripsi >4900 char"))
            continue

        print(f"  {vid}  {sn['publishedAt'][:10]}  {sn['title'][:45]!r}  → {' | '.join(aksi)}")
        if APPLY:
            try:
                yt.videos().update(part="snippet", body={"id": vid, "snippet": snippet_baru}).execute()
                ok.append(vid)
                time.sleep(0.15)
            except HttpError as e:
                gagal.append((vid, f"HTTP {e.resp.status}: {e.reason}"))
                print(f"        ❌ {e.resp.status} {e.reason}")

    print(f"\n{'SELESAI' if APPLY else 'UJI SELESAI'} — diperbaiki: {len(ok)} | "
          f"sudah rapi: {rapi} | gagal: {len(gagal)}")
    for vid, why in gagal:
        print(f"  ❌ {vid}: {why}")


if __name__ == "__main__":
    main()
