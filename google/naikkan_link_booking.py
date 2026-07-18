#!/usr/bin/env python3
"""Naikkan link booking ke BARIS PERTAMA deskripsi video YouTube.

MASALAH: link booking sekarang ada di baris ke-6, karakter ke-175 dari 345.
YouTube memotong deskripsi setelah satu-dua baris ("...lainnya"), dan di
Shorts — yang menyumbang hampir seluruh tontonan kanal ini — deskripsi bahkan
harus diketuk dulu. Jadi link yang sudah susah payah diberi `?src=yt` praktis
tak pernah terlihat.

Angkanya: 10.373 tayangan dalam 7 hari menghasilkan 5 kunjungan situs = 0,05%.

PERBAIKAN: sisipkan SATU baris di paling atas, sebelum apa pun. Tidak ada
yang dihapus, tidak ada yang disusun ulang — blok deskripsi standar di bawah
tetap utuh apa adanya. Diff sekecil mungkin supaya mudah dibatalkan.

HIPOTESIS YANG BISA DIBUKTIKAN SALAH: kalau posisi link memang penyebabnya,
rasio kunjungan-per-tayangan harus naik dari garis dasar 0,05%. Kalau setelah
sepekan tidak bergerak, berarti dugaan ini salah — penontonnya memang tidak
berniat mengeklik apa pun, dan jalur konversi harus dicari di tempat lain
(mis. ajakan di dalam videonya sendiri). Pantau lewat laporan/papan_skor.py.

Idempoten: video yang barisnya sudah ada akan dilewati.

Pakai:
    <venv>/bin/python naikkan_link_booking.py            # uji, tanpa perubahan
    <venv>/bin/python naikkan_link_booking.py --apply    # eksekusi
    <venv>/bin/python naikkan_link_booking.py --batalkan --apply   # kembalikan
"""
import sys
import time
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

APPLY = "--apply" in sys.argv
BATALKAN = "--batalkan" in sys.argv
# Ubah sedikit dulu, periksa hasilnya di YouTube, baru lanjut. Perubahan pada
# 136 deskripsi publik sekaligus tanpa dilihat dulu itu taruhan yang tak perlu.
BATAS = 0
for _i, _a in enumerate(sys.argv):
    if _a == "--batas" and _i + 1 < len(sys.argv):
        BATAS = int(sys.argv[_i + 1])
ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"

BARIS = "📲 Booking & harga: https://rrhaircare.id/?src=yt"


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


def ambil_semua(yt) -> dict:
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
    out = {}
    for i in range(0, len(ids), 50):
        for v in yt.videos().list(id=",".join(ids[i:i + 50]),
                                  part="snippet,status").execute()["items"]:
            out[v["id"]] = v
    return out


def main() -> None:
    yt = build("youtube", "v3", credentials=creds())
    semua = ambil_semua(yt)
    pub = {k: v for k, v in semua.items() if v["status"]["privacyStatus"] == "public"}

    mode = "BATALKAN" if BATALKAN else "NAIKKAN"
    print(f"{mode} — {'MODE APPLY' if APPLY else 'mode uji (tanpa perubahan)'}")
    print(f"Video publik: {len(pub)}")

    ok, gagal, lewati = [], [], 0
    for vid, v in sorted(pub.items(), key=lambda kv: kv[1]["snippet"]["publishedAt"]):
        sn = v["snippet"]
        desc = sn.get("description", "")
        sudah = desc.startswith(BARIS)

        if BATALKAN:
            if not sudah:
                lewati += 1
                continue
            baru = desc[len(BARIS):].lstrip("\n")
        else:
            if sudah:
                lewati += 1
                continue
            baru = BARIS + "\n\n" + desc if desc.strip() else BARIS

        if len(baru) > 4900:
            gagal.append((vid, "deskripsi >4900 char"))
            continue

        snippet_baru = {
            "title": sn["title"],
            "description": baru,
            "categoryId": sn["categoryId"],
            "tags": sn.get("tags", []),
            "defaultAudioLanguage": sn.get("defaultAudioLanguage") or "id",
        }
        if sn.get("defaultLanguage"):
            snippet_baru["defaultLanguage"] = sn["defaultLanguage"]

        if BATAS and len(ok) >= BATAS:
            print(f"  … berhenti di batas {BATAS}")
            break

        print(f"  {vid}  {sn['publishedAt'][:10]}  {sn['title'][:44]}")
        if APPLY:
            try:
                yt.videos().update(part="snippet",
                                   body={"id": vid, "snippet": snippet_baru}).execute()
                ok.append(vid)
                time.sleep(0.15)
            except HttpError as e:
                gagal.append((vid, f"HTTP {e.resp.status}: {e.reason}"))
                print(f"      ❌ {e.resp.status} {e.reason}")

    print(f"\n{'SELESAI' if APPLY else 'UJI SELESAI'} — "
          f"diubah: {len(ok)} | sudah sesuai: {lewati} | gagal: {len(gagal)}")
    for vid, why in gagal:
        print(f"  ❌ {vid}: {why}")
    if not APPLY:
        print("\nJalankan dengan --apply untuk mengeksekusi.")


if __name__ == "__main__":
    main()
