#!/usr/bin/env python3
"""Tandai link rrhaircare.id di deskripsi YouTube dengan ?src=yt.

KENAPA: aplikasi YouTube di HP sering TIDAK mengirim referrer, jadi kunjungan
yang sebenarnya datang dari YouTube masuk ke kolom "Langsung" di panel
analitik toko. Parameter ?src=yt dibaca beacon situs (public/js/hit.js) dan
menang atas referrer, jadi atribusinya benar walau referrer hilang.

  https://rrhaircare.id        → https://rrhaircare.id/?src=yt
  https://rrhaircare.id/#harga → https://rrhaircare.id/?src=yt#harga

Pakai:
    python3 tambah_src_youtube.py            # DRY-RUN, tak mengubah apa pun
    python3 tambah_src_youtube.py --apply    # eksekusi
    python3 tambah_src_youtube.py --apply --batas 40   # batasi jumlah (hemat kuota)

Aman diulang: video yang sudah punya '?src=yt' dilewati, jadi kalau kuota
habis di tengah jalan tinggal jalankan lagi besok — ia lanjut dari sisanya.
Biaya kuota: 50 unit per video yang BENAR-BENAR diubah (kuota harian 10.000).
"""
import json
import re
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

APPLY = "--apply" in sys.argv
ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"
LOG = ROOT / "data" / "src_yt.log"

BATAS = None
if "--batas" in sys.argv:
    BATAS = int(sys.argv[sys.argv.index("--batas") + 1])

PENANDA = "?src=yt"

# Urutan PENTING: varian '#harga' harus diganti lebih dulu, kalau tidak
# pola polos ikut memakannya dan hasilnya jadi '.../?src=yt/#harga'.
GANTI = [
    (re.compile(r"https://rrhaircare\.id/#harga\b"), "https://rrhaircare.id/?src=yt#harga"),
    (re.compile(r"https://rrhaircare\.id/?(?![\w/?#])"), "https://rrhaircare.id/?src=yt"),
    # Sebagian deskripsi lama tulis domainnya polos ("Website : rrhaircare.id") —
    # YouTube tetap menjadikannya tautan. Lookbehind menjaga agar pola ini tidak
    # memakan ekor URL https yang sudah ditangani dua pola di atas.
    # '@' dikecualikan supaya alamat email (admin@rrhaircare.id) tidak dirusak.
    (re.compile(r"(?<![/\w.@])rrhaircare\.id(?![\w/?#.])"), "rrhaircare.id/?src=yt"),
]


def tandai(desc: str) -> str:
    if PENANDA in desc:
        return desc
    for pola, ganti in GANTI:
        desc = pola.sub(ganti, desc)
    return desc


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


def main():
    yt = build("youtube", "v3", credentials=creds())

    ch = yt.channels().list(part="contentDetails", mine=True).execute()["items"][0]
    up = ch["contentDetails"]["relatedPlaylists"]["uploads"]

    ids, tok = [], None
    while True:
        r = yt.playlistItems().list(part="contentDetails", playlistId=up,
                                    maxResults=50, pageToken=tok).execute()
        ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        tok = r.get("nextPageToken")
        if not tok:
            break

    vids = {}
    for i in range(0, len(ids), 50):
        r = yt.videos().list(id=",".join(ids[i:i + 50]), part="snippet,status",
                             maxResults=50).execute()
        for v in r["items"]:
            vids[v["id"]] = v

    # Deskripsi CHANNEL — link paling sering diklik (tampil di halaman kanal),
    # jadi jangan sampai terlewat seperti pada pass pertama 18 Jul.
    chd = yt.channels().list(part="brandingSettings", mine=True).execute()["items"][0]
    kanal_lama = chd["brandingSettings"]["channel"].get("description", "")
    kanal_baru = tandai(kanal_lama)
    if kanal_baru != kanal_lama:
        if APPLY:
            # Kirim HANYA field channel yang kita pegang. Mengirim balik seluruh
            # brandingSettings (termasuk blok image) bikin YouTube membalas 200
            # tapi diam-diam TIDAK menyimpan perubahan — terjadi 18 Jul 2026.
            k = chd["brandingSettings"]["channel"]
            yt.channels().update(part="brandingSettings", body={
                "id": chd["id"],
                "brandingSettings": {"channel": {
                    "description": kanal_baru,
                    "keywords": k.get("keywords", ""),
                    "country": k.get("country", "ID"),
                }},
            }).execute()
            print("Deskripsi channel: DITANDAI")
        else:
            print("Deskripsi channel: perlu ditandai")
    else:
        print("Deskripsi channel: sudah bertanda")

    pub = {k: v for k, v in vids.items() if v["status"]["privacyStatus"] == "public"}
    perlu = []
    for vid, v in pub.items():
        d = v["snippet"].get("description", "")
        baru = tandai(d)
        if baru != d:
            perlu.append((vid, v, baru))

    print("MODE UJI (tanpa perubahan)" if not APPLY else "=== MODE APPLY ===")
    print(f"Video publik: {len(pub)} | perlu ditandai: {len(perlu)} | "
          f"sudah bertanda: {len(pub) - len(perlu)}")
    if perlu:
        print(f"Perkiraan kuota: {len(perlu) * 50} unit")

    if not perlu:
        print("\nTUNTAS — semua deskripsi sudah bertanda ?src=yt.")
        return

    if not APPLY:
        vid, v, baru = perlu[0]
        lama = v["snippet"]["description"]
        print(f"\nContoh perubahan pada {vid} ({v['snippet']['title'][:50]}):")
        for a, b in zip(lama.splitlines(), baru.splitlines()):
            if a != b:
                print(f"  - {a}\n  + {b}")
        print("\nJalankan ulang dengan --apply untuk mengeksekusi.")
        return

    antre = perlu[:BATAS] if BATAS else perlu
    ok, gagal = 0, 0
    LOG.parent.mkdir(exist_ok=True)
    with LOG.open("a") as log:
        for n, (vid, v, baru) in enumerate(antre, 1):
            sn = v["snippet"]
            body = {"id": vid, "snippet": {
                "title": sn["title"],
                "description": baru,
                "categoryId": sn["categoryId"],
                "tags": sn.get("tags", []),
            }}
            if sn.get("defaultLanguage"):
                body["snippet"]["defaultLanguage"] = sn["defaultLanguage"]
            if sn.get("defaultAudioLanguage"):
                body["snippet"]["defaultAudioLanguage"] = sn["defaultAudioLanguage"]
            try:
                yt.videos().update(part="snippet", body=body).execute()
                ok += 1
                print(f"  [{n}/{len(antre)}] OK  {vid}", end="\r", flush=True)
            except HttpError as e:
                isi = e.content.decode("utf-8", "replace")
                if "quotaExceeded" in isi or e.resp.status == 403:
                    print(f"\nKUOTA HABIS setelah {ok} video. "
                          f"Sisa {len(perlu) - ok} — jalankan lagi setelah kuota "
                          f"reset (±14.00 WIB).")
                    log.write(f"kuota habis, selesai {ok}, sisa {len(perlu) - ok}\n")
                    break
                gagal += 1
                print(f"\n  GAGAL {vid}: {isi[:200]}")
        else:
            print(" " * 40, end="\r")
            print(f"\nSELESAI — ditandai: {ok} | gagal: {gagal} | "
                  f"sisa: {len(perlu) - ok}")
            log.write(f"ditandai {ok}, gagal {gagal}, sisa {len(perlu) - ok}\n")


if __name__ == "__main__":
    main()
