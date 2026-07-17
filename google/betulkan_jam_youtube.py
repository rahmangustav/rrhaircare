"""Koreksi jam buka di deskripsi YouTube (channel + semua video publik).

Fakta benar (konfirmasi user 15 Jul 2026): buka SETIAP HARI, 09.00–21.00 WIB.
Skrip mengganti kedua varian yang salah:
  "Senin–Sabtu, 09.00–18.00 WIB"  →  "Setiap Hari, 09.00–21.00 WIB"
  "Senin–Sabtu, 09.00–21.00 WIB"  →  "Setiap Hari, 09.00–21.00 WIB"

Jalankan:  .venv/bin/python betulkan_jam_youtube.py

Hanya menyentuh deskripsi yang masih memuat teks lama, jadi AMAN dijalankan
berulang (resumable). Kalau kuota API harian habis di tengah jalan
(403 quotaExceeded), skrip berhenti rapi dan menyebut sisa video — jalankan
lagi setelah kuota reset (±14.00 WIB).
"""
import time
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"
PASANGAN = [
    ("Senin–Sabtu, 09.00–18.00 WIB", "Setiap Hari, 09.00–21.00 WIB"),
    ("Senin–Sabtu, 09.00–21.00 WIB", "Setiap Hari, 09.00–21.00 WIB"),
]


def perlu_koreksi(teks: str) -> bool:
    return any(lama in teks for lama, _ in PASANGAN)


def koreksi(teks: str) -> str:
    for lama, baru in PASANGAN:
        teks = teks.replace(lama, baru)
    return teks


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


yt = build("youtube", "v3", credentials=creds())


def cek_kuota(e: HttpError):
    """Kalau errornya kuota habis, berhenti rapi dengan petunjuk; selain itu lempar lagi."""
    if e.resp.status == 403 and b"quota" in e.content.lower():
        raise SystemExit(
            "⛔ Kuota API harian masih habis — belum ada yang diubah.\n"
            "   Kuota reset ±14.00 WIB. Jalankan lagi setelah itu:\n"
            "   .venv/bin/python betulkan_jam_youtube.py"
        )
    raise e


# ---- channel dulu (paling terlihat, murah) ----
try:
    ch = yt.channels().list(mine=True, part="brandingSettings").execute()["items"][0]
except HttpError as e:
    cek_kuota(e)
b = ch["brandingSettings"]["channel"]
if perlu_koreksi(b.get("description", "")):
    try:
        yt.channels().update(part="brandingSettings", body={
            "id": ch["id"],
            "brandingSettings": {"channel": {
                "description": koreksi(b["description"]),
                "keywords": b.get("keywords", ""),
                "country": b.get("country", "ID"),
            }},
        }).execute()
        print("✅ deskripsi channel dikoreksi")
    except HttpError as e:
        if e.resp.status == 403 and b"quota" in e.content.lower():
            cek_kuota(e)
        print(f"❌ channel: HTTP {e.resp.status} {e.reason}")
else:
    print("• deskripsi channel sudah benar")

# ---- semua video publik ----
try:
    uploads = yt.channels().list(mine=True, part="contentDetails").execute()[
        "items"][0]["contentDetails"]["relatedPlaylists"]["uploads"]
    vids, page = [], None
    while True:
        r = yt.playlistItems().list(playlistId=uploads, part="contentDetails",
                                    maxResults=50, pageToken=page).execute()
        vids += [i["contentDetails"]["videoId"] for i in r["items"]]
        page = r.get("nextPageToken")
        if not page:
            break

    perlu = []
    for i in range(0, len(vids), 50):
        r = yt.videos().list(id=",".join(vids[i:i + 50]), part="snippet,status",
                             maxResults=50).execute()
        for v in r["items"]:
            if v["status"]["privacyStatus"] == "public" and perlu_koreksi(v["snippet"].get("description", "")):
                perlu.append(v)
except HttpError as e:
    cek_kuota(e)

print(f"Video yang masih perlu dikoreksi: {len(perlu)}")
ok, kuota_habis = 0, False
for n, v in enumerate(perlu, 1):
    sn = v["snippet"]
    body = {"id": v["id"], "snippet": {
        "title": sn["title"],
        "description": koreksi(sn["description"]),
        "categoryId": sn["categoryId"],
        "tags": sn.get("tags", []),
        "defaultAudioLanguage": sn.get("defaultAudioLanguage") or "id",
    }}
    if sn.get("defaultLanguage"):
        body["snippet"]["defaultLanguage"] = sn["defaultLanguage"]
    try:
        yt.videos().update(part="snippet", body=body).execute()
        ok += 1
        print(f"[{n:>3}/{len(perlu)}] {v['id']} ✅")
        time.sleep(0.15)
    except HttpError as e:
        if e.resp.status == 403 and b"quota" in e.content.lower():
            kuota_habis = True
            print(f"\n⛔ Kuota API harian habis setelah {ok} video.")
            break
        print(f"[{n:>3}/{len(perlu)}] {v['id']} ❌ HTTP {e.resp.status} {e.reason}")

sisa = len(perlu) - ok
print(f"\nSELESAI — dikoreksi: {ok} | sisa: {sisa}")
if sisa:
    print("Jalankan lagi skrip ini setelah kuota reset (±14.00 WIB besok):")
    print("   .venv/bin/python betulkan_jam_youtube.py")
