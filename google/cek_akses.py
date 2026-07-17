"""Uji akses akun Google RR Hair Care setelah login (token.json).

Jalankan:  .venv/bin/python cek_akses.py

Mengecek satu per satu: YouTube, Google Bisnis, Drive (laporan keuangan).
Kalau ada API yang belum diaktifkan di Google Cloud, skrip ini menyebutkan
URL untuk mengaktifkannya — bukan error yang bikin panik.
"""
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

ROOT = Path(__file__).parent
TOKEN_FILE = ROOT / "token.json"


def creds():
    c = Credentials.from_authorized_user_file(str(TOKEN_FILE))
    if c.expired and c.refresh_token:
        c.refresh(Request())
        TOKEN_FILE.write_text(c.to_json())
    return c


def _jelaskan(e: HttpError, nama_api: str) -> str:
    if e.resp.status == 403 and b"accessNotConfigured" in e.content:
        return (
            f"API '{nama_api}' belum diaktifkan di project Google Cloud ini.\n"
            f"   Aktifkan di: https://console.cloud.google.com/apis/library"
        )
    return f"HTTP {e.resp.status}: {e.reason}"


def cek_youtube(c):
    print("\n[1/3] YouTube …")
    try:
        yt = build("youtube", "v3", credentials=c)
        r = yt.channels().list(part="snippet,statistics", mine=True).execute()
        items = r.get("items", [])
        if not items:
            print("   ⚠️  Login sukses tapi akun ini tidak punya channel YouTube.")
            return
        ch = items[0]
        s = ch["statistics"]
        print(f"   ✅ Channel: {ch['snippet']['title']}")
        print(
            f"      Subscriber: {s.get('subscriberCount','?')} · "
            f"Video: {s.get('videoCount','?')} · Views: {s.get('viewCount','?')}"
        )
    except HttpError as e:
        print(f"   ❌ {_jelaskan(e, 'YouTube Data API v3')}")


def cek_google_bisnis(c):
    print("\n[2/3] Google Bisnis …")
    try:
        akun_api = build("mybusinessaccountmanagement", "v1", credentials=c)
        akun = akun_api.accounts().list().execute().get("accounts", [])
        if not akun:
            print("   ⚠️  Tidak ada akun Business Profile terdaftar.")
            return
        print(f"   ✅ Akun bisnis: {akun[0].get('accountName', akun[0]['name'])}")
        try:
            info_api = build("mybusinessbusinessinformation", "v1", credentials=c)
            lokasi = (
                info_api.accounts()
                .locations()
                .list(parent=akun[0]["name"], readMask="title,storefrontAddress")
                .execute()
                .get("locations", [])
            )
            for lok in lokasi[:5]:
                print(f"      Lokasi: {lok.get('title', '(tanpa nama)')}")
            if not lokasi:
                print("      (belum ada lokasi usaha)")
        except HttpError as e:
            print(f"   ⚠️  Daftar lokasi gagal: {_jelaskan(e, 'My Business Business Information API')}")
    except HttpError as e:
        print(f"   ❌ {_jelaskan(e, 'My Business Account Management API')}")
        print(
            "      Catatan: API Business Profile juga butuh persetujuan akses dari\n"
            "      Google (form khusus); kuota awal 0 sebelum disetujui."
        )


def cek_drive(c):
    print("\n[3/3] Drive (laporan keuangan) …")
    try:
        drive = build("drive", "v3", credentials=c)
        r = (
            drive.files()
            .list(
                q="(name contains 'laporan' or name contains 'keuangan') and trashed=false",
                pageSize=10,
                fields="files(name,mimeType,modifiedTime)",
                orderBy="modifiedTime desc",
            )
            .execute()
        )
        files = r.get("files", [])
        if files:
            print(f"   ✅ Ketemu {len(files)} file cocok 'laporan/keuangan' (terbaru dulu):")
            for f in files:
                jenis = "Sheets" if "spreadsheet" in f["mimeType"] else f["mimeType"].split(".")[-1]
                print(f"      - {f['name']}  [{jenis}]  ({f['modifiedTime'][:10]})")
        else:
            print("   ✅ Akses Drive jalan, tapi tidak ada file bernama 'laporan/keuangan'.")
            r2 = drive.files().list(pageSize=5, fields="files(name)", orderBy="modifiedTime desc").execute()
            print("      5 file terbaru:", ", ".join(f["name"] for f in r2.get("files", [])) or "(kosong)")
    except HttpError as e:
        print(f"   ❌ {_jelaskan(e, 'Google Drive API')}")


if __name__ == "__main__":
    if not TOKEN_FILE.exists():
        raise SystemExit("❌ token.json belum ada. Jalankan dulu auth_rrhaircare.py.")
    c = creds()
    cek_youtube(c)
    cek_google_bisnis(c)
    cek_drive(c)
    print("\nSelesai.")
