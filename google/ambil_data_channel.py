"""Ambil data lengkap channel YouTube RR Hair Care untuk audit.

Jalankan:  .venv/bin/python ambil_data_channel.py

Menyimpan snapshot ke data/audit_<tanggal>.json:
- info channel (statistik, branding, status)
- SEMUA video dari playlist uploads (snippet+statistics+contentDetails+status)
- daftar playlist

Kuota API sangat kecil (±10 unit), aman dijalankan kapan pun.
"""
import json
from datetime import datetime, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"
OUT_DIR = ROOT / "data"
OUT_DIR.mkdir(exist_ok=True)


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


def main():
    yt = build("youtube", "v3", credentials=creds())

    ch = (
        yt.channels()
        .list(part="snippet,statistics,contentDetails,brandingSettings,status", mine=True)
        .execute()["items"][0]
    )
    uploads = ch["contentDetails"]["relatedPlaylists"]["uploads"]

    video_ids, page = [], None
    while True:
        r = (
            yt.playlistItems()
            .list(playlistId=uploads, part="contentDetails", maxResults=50, pageToken=page)
            .execute()
        )
        video_ids += [i["contentDetails"]["videoId"] for i in r["items"]]
        page = r.get("nextPageToken")
        if not page:
            break

    videos = []
    for i in range(0, len(video_ids), 50):
        r = (
            yt.videos()
            .list(
                id=",".join(video_ids[i : i + 50]),
                part="snippet,statistics,contentDetails,status",
                maxResults=50,
            )
            .execute()
        )
        videos += r["items"]

    playlists = (
        yt.playlists()
        .list(part="snippet,contentDetails", mine=True, maxResults=50)
        .execute()
        .get("items", [])
    )

    data = {
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "channel": ch,
        "videos": videos,
        "playlists": playlists,
    }
    out = OUT_DIR / f"audit_{datetime.now():%Y%m%d}.json"
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    print(f"✅ {len(videos)} video + {len(playlists)} playlist tersimpan → {out}")


if __name__ == "__main__":
    main()
