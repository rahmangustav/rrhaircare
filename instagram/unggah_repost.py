#!/usr/bin/env python3
"""Unggah Reel Instagram yang sudah disiapkan ke YouTube Shorts (kanal salon).

Baca `repost/manifest.json` hasil `siapkan_repost.py`, lalu unggah video yang
belum pernah diunggah. BERTAHAP — default 3 video sekali jalan, supaya kalau
judul atau deskripsinya meleset masih bisa dikoreksi sebelum menyebar ke semua.

Pakai:
    python3 unggah_repost.py                 # uji coba, tidak mengunggah
    python3 unggah_repost.py --apply         # unggah 3 video pertama
    python3 unggah_repost.py --apply --batas 5
    python3 unggah_repost.py --apply --privasi unlisted

Aman diulang: video yang sudah punya `youtube_id` di manifest dilewati, jadi
tak ada yang dobel walau skrip dijalankan lagi.
"""
import json
import os
import sys

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

ROOT = os.path.dirname(os.path.abspath(__file__))
REPOST = os.path.join(ROOT, "repost")
MANIFEST = os.path.join(REPOST, "manifest.json")
TOKEN = os.path.join(os.path.dirname(ROOT), "google", "token.json")

# 26 = Howto & Style. Kategori yang benar membantu YouTube menawarkan video
# ini ke orang yang memang menonton konten salon/perawatan.
KATEGORI = "26"
TAGS = ["rr hair care", "salon koja", "salon jakarta utara", "perawatan rambut",
        "smoothing", "keratin", "coloring rambut", "salon jakarta"]


def creds():
    c = Credentials.from_authorized_user_file(TOKEN)
    if c.expired and c.refresh_token:
        c.refresh(Request())
        with open(TOKEN, "w") as f:
            f.write(c.to_json())
    return c


def main():
    apply = "--apply" in sys.argv
    batas = 3
    if "--batas" in sys.argv:
        batas = int(sys.argv[sys.argv.index("--batas") + 1])
    privasi = "public"
    if "--privasi" in sys.argv:
        privasi = sys.argv[sys.argv.index("--privasi") + 1]

    with open(MANIFEST) as f:
        m = json.load(f)

    antre = [v for v in m["video"]
             if not v.get("jangan_unggah") and not v.get("youtube_id")]
    dilewati = [v for v in m["video"] if v.get("jangan_unggah")]
    sudah = [v for v in m["video"] if v.get("youtube_id")]

    print(f"{'MODE UJI (tidak mengunggah)' if not apply else '=== MODE UNGGAH ==='}")
    print(f"Antre: {len(antre)} | sudah diunggah: {len(sudah)} | "
          f"sengaja dilewati: {len(dilewati)}")
    for v in dilewati:
        print(f"  DILEWATI — {v['tanggal_ig']}: {v['jangan_unggah']}")

    giliran = antre[:batas]
    if not giliran:
        print("\nTidak ada yang perlu diunggah.")
        return

    print(f"\nGiliran ini ({len(giliran)} video, privasi={privasi}):")
    for i, v in enumerate(giliran, 1):
        print(f"  {i}. {v['judul']}")
        print(f"     {v['berkas']}  {v['ukuran_mb']} MB")

    if not apply:
        print("\nJalankan dengan --apply untuk benar-benar mengunggah.")
        return

    yt = build("youtube", "v3", credentials=creds())
    berhasil = gagal = 0
    for i, v in enumerate(giliran, 1):
        path = os.path.join(REPOST, v["berkas"])
        if not os.path.exists(path):
            print(f"  [{i}] LEWAT — berkas hilang: {v['berkas']}")
            continue
        body = {
            "snippet": {
                "title": v["judul"][:100],
                "description": v["deskripsi"][:4900],
                "tags": TAGS,
                "categoryId": KATEGORI,
                # Pelajaran 18 Jul: video tanpa defaultAudioLanguage lolos dari
                # standar kanal dan harus di-backfill belakangan. Set dari awal.
                "defaultLanguage": "id",
                "defaultAudioLanguage": "id",
            },
            "status": {"privacyStatus": privasi, "selfDeclaredMadeForKids": False},
        }
        try:
            media = MediaFileUpload(path, chunksize=-1, resumable=True,
                                    mimetype="video/mp4")
            req = yt.videos().insert(part="snippet,status", body=body, media_body=media)
            resp = req.execute()
            vid = resp["id"]
            v["youtube_id"] = vid
            v["youtube_url"] = f"https://youtu.be/{vid}"
            berhasil += 1
            print(f"  [{i}/{len(giliran)}] OK  https://youtu.be/{vid}  {v['judul'][:45]}")
        except HttpError as e:
            isi = e.content.decode("utf-8", "replace")
            gagal += 1
            print(f"  [{i}/{len(giliran)}] GAGAL {v['berkas']}: {isi[:250]}")
            if "quotaExceeded" in isi or "uploadLimitExceeded" in isi:
                print("  Kuota/limit upload habis — hentikan, lanjutkan besok.")
                break
        finally:
            # Simpan manifest tiap video supaya progres tak hilang kalau putus.
            with open(MANIFEST, "w") as f:
                json.dump(m, f, ensure_ascii=False, indent=1)

    sisa = len([x for x in m["video"] if not x.get("jangan_unggah") and not x.get("youtube_id")])
    print(f"\nSELESAI giliran ini — berhasil {berhasil} | gagal {gagal} | sisa antre {sisa}")
    print("Periksa hasilnya di YouTube Studio sebelum menjalankan batch berikutnya.")


if __name__ == "__main__":
    main()
