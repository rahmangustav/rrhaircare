"""Login OAuth akun Google RR Hair Care tanpa browser di mesin ini (headless), 2 langkah.

Akses yang diminta: YouTube (kelola channel toko), Google Bisnis (profil usaha),
dan Drive/Sheets baca-saja (laporan keuangan).

LANGKAH 1 (tanpa argumen) — cetak URL otorisasi:
    .venv/bin/python auth_rrhaircare.py

  Buka URL itu di browser HP/laptop -> login akun Google RR HAIR CARE -> setujui.
  Browser akan diarahkan ke  http://localhost/?...&code=XXXX...  (halaman GAGAL
  dimuat, itu normal). Salin nilai 'code' dari address bar (atau seluruh URL).

LANGKAH 2 (dengan kode/URL sebagai argumen) — tukar jadi token.json:
    .venv/bin/python auth_rrhaircare.py "PASTE_CODE_ATAU_URL_DISINI"

Setelah token.json jadi, uji akses:  .venv/bin/python cek_akses.py
"""
import json
import sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs

from google_auth_oauthlib.flow import Flow

ROOT = Path(__file__).parent
CLIENT_SECRETS = ROOT / "client_secrets.json"
TOKEN_FILE = ROOT / "token.json"
PENDING = ROOT / ".oauth_pending.json"
REDIRECT = "http://localhost/"

SCOPES = [
    # YouTube channel RR Hair Care: baca data + upload + kelola metadata/komentar
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/youtube.force-ssl",
    # Profil Google Bisnis (Business Profile)
    "https://www.googleapis.com/auth/business.manage",
    # Laporan keuangan di Drive/Sheets — BACA SAJA, tidak bisa mengubah/menghapus
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]


def step1_print_url():
    flow = Flow.from_client_secrets_file(str(CLIENT_SECRETS), scopes=SCOPES)
    flow.redirect_uri = REDIRECT
    auth_url, _ = flow.authorization_url(
        access_type="offline", prompt="consent", include_granted_scopes="true"
    )
    # Simpan code_verifier (PKCE) supaya bisa dipakai di langkah 2 (proses beda).
    PENDING.write_text(json.dumps({"code_verifier": flow.code_verifier}))
    print("\n=== LANGKAH 1: buka URL ini, login akun Google RR HAIR CARE ===\n")
    print(auth_url)
    print(
        "\nSetelah setujui, browser diarahkan ke http://localhost/?...code=XXXX "
        "(gagal dimuat = normal).\nSalin kode/URL-nya, lalu jalankan:\n"
        '   .venv/bin/python auth_rrhaircare.py "PASTE_DISINI"\n'
    )


def _extract_code(arg: str) -> str:
    arg = arg.strip()
    if arg.startswith("http"):
        q = parse_qs(urlparse(arg).query)
        if "code" not in q:
            sys.exit("❌ URL tidak mengandung parameter 'code'.")
        return q["code"][0]
    return arg


def step2_exchange(arg: str):
    if not PENDING.exists():
        sys.exit("❌ Belum ada sesi login. Jalankan dulu langkah 1 (tanpa argumen).")
    code_verifier = json.loads(PENDING.read_text())["code_verifier"]
    flow = Flow.from_client_secrets_file(
        str(CLIENT_SECRETS), scopes=SCOPES, code_verifier=code_verifier
    )
    flow.redirect_uri = REDIRECT
    code = _extract_code(arg)
    flow.fetch_token(code=code)
    TOKEN_FILE.write_text(flow.credentials.to_json())
    TOKEN_FILE.chmod(0o600)
    PENDING.unlink(missing_ok=True)
    print(f"✅ Token tersimpan di {TOKEN_FILE}")
    print("   Lanjut uji akses:  .venv/bin/python cek_akses.py")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        step2_exchange(sys.argv[1])
    else:
        step1_print_url()
