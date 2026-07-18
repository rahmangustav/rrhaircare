#!/usr/bin/env python3
"""Laporan performa Instagram @rrhaircareofficial.

Ambil N media terakhir + insights-nya, urutkan dari jangkauan terbesar,
lalu simpan snapshot JSON supaya bisa dibandingkan minggu depan.

Pakai:
    python3 lapor_ig.py            # 25 media terakhir
    python3 lapor_ig.py 50         # 50 media terakhir
    python3 lapor_ig.py --banding   # bandingkan dengan snapshot sebelumnya

Token dibaca langsung dari config MCP (~/.claude.json) saat jalan dan
TIDAK PERNAH dicetak ke layar maupun disimpan ke berkas.
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone, timedelta

GRAPH = "https://graph.facebook.com/v25.0"
IG_ID = "17841400394773966"
WIB = timezone(timedelta(hours=7))
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def ambil_token() -> str:
    cfg = os.path.expanduser("~/.claude.json")
    with open(cfg) as f:
        d = json.load(f)
    try:
        return d["mcpServers"]["meta-instagram"]["env"]["INSTAGRAM_ACCESS_TOKEN"]
    except KeyError:
        sys.exit("Token MCP meta-instagram tidak ditemukan di ~/.claude.json")


def get(token: str, path: str, **params):
    params["access_token"] = token
    url = f"{GRAPH}/{path}?" + urllib.parse.urlencode(params)
    for percobaan in range(3):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", "replace")
            # Jangan bocorkan URL (ada token di dalamnya) ke pesan error.
            if e.code in (429, 500, 503) and percobaan < 2:
                time.sleep(3 * (percobaan + 1))
                continue
            sys.exit(f"Graph API error {e.code} pada /{path}: {body[:300]}")
    return {}


def wib(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("+0000", "+00:00")).astimezone(WIB)


def jenis(m: dict) -> str:
    """Reel vs foto — dibedakan dari permalink, bukan media_type (VIDEO = keduanya)."""
    if "/reel/" in m.get("permalink", ""):
        return "Reel"
    return "Foto"


def kumpulkan(token: str, jumlah: int) -> list:
    fields = "id,caption,media_type,permalink,timestamp,like_count,comments_count"
    media, after = [], None
    while len(media) < jumlah:
        p = {"fields": fields, "limit": min(50, jumlah - len(media))}
        if after:
            p["after"] = after
        r = get(token, f"{IG_ID}/media", **p)
        media += r.get("data", [])
        after = r.get("paging", {}).get("cursors", {}).get("after")
        if not r.get("paging", {}).get("next"):
            break

    hasil = []
    for i, m in enumerate(media[:jumlah], 1):
        print(f"  insights {i}/{min(jumlah, len(media))}…", end="\r", flush=True)
        metrik = "views,reach,saved,shares"
        if jenis(m) == "Reel":
            metrik += ",reels_skip_rate"  # cuma ada di Reel
        ins = get(token, f"{m['id']}/insights", metric=metrik)
        nilai = {d["name"]: d["values"][0]["value"] for d in ins.get("data", [])}
        cap = (m.get("caption") or "").replace("\n", " ")
        hasil.append({
            "id": m["id"],
            "tanggal": wib(m["timestamp"]).strftime("%Y-%m-%d %H:%M"),
            "jenis": jenis(m),
            "permalink": m.get("permalink", ""),
            "judul": (cap[:60] + "…") if len(cap) > 60 else (cap or "(tanpa caption)"),
            "views": nilai.get("views", 0),
            "reach": nilai.get("reach", 0),
            "saved": nilai.get("saved", 0),
            "shares": nilai.get("shares", 0),
            "likes": m.get("like_count", 0),
            "comments": m.get("comments_count", 0),
            # % penonton yang kabur sebelum 3 detik — makin kecil makin bagus hook-nya
            "skip": nilai.get("reels_skip_rate", None),
        })
    print(" " * 40, end="\r")
    return hasil


def ringkas(rows: list, follower: int):
    reach = sorted(r["reach"] for r in rows)
    med = reach[len(reach) // 2] if reach else 0
    reels = [r for r in rows if r["jenis"] == "Reel"]
    fotos = [r for r in rows if r["jenis"] == "Foto"]
    m = lambda xs: (sorted(xs)[len(xs) // 2] if xs else 0)
    skips = [r["skip"] for r in rows if r.get("skip") is not None]
    return {
        "follower": follower,
        "skip_median_reel": round(m(skips), 1) if skips else 0,
        "jumlah_post": len(rows),
        "reach_median": med,
        "reach_terbaik": max(reach) if reach else 0,
        "reach_median_reel": m([r["reach"] for r in reels]),
        "reach_median_foto": m([r["reach"] for r in fotos]),
        "persen_follower_terjangkau": round(med / follower * 100, 1) if follower else 0,
        "total_saved": sum(r["saved"] for r in rows),
        "total_shares": sum(r["shares"] for r in rows),
        "total_comments": sum(r["comments"] for r in rows),
        "engagement_rate_median": round(
            m([(r["likes"] + r["comments"]) / r["reach"] * 100 for r in rows if r["reach"]]), 2),
    }


def cetak(rows: list, s: dict):
    print(f"\n{'':=<86}")
    print(f"LAPORAN INSTAGRAM @rrhaircareofficial — "
          f"{datetime.now(WIB).strftime('%d %b %Y %H:%M')} WIB")
    print(f"{'':=<86}")
    print(f"Follower: {s['follower']:,}".replace(",", "."))
    print(f"Jangkauan median: {s['reach_median']} "
          f"({s['persen_follower_terjangkau']}% dari follower sendiri) · "
          f"terbaik {s['reach_terbaik']}")
    print(f"Median per format: Reel {s['reach_median_reel']} · Foto {s['reach_median_foto']}")
    print(f"Tingkat lewati median (Reel): {s['skip_median_reel']}% "
          f"— makin kecil makin kuat 3 detik pertamanya")
    print(f"Engagement median: {s['engagement_rate_median']}% dari yang terjangkau")
    print(f"Total dari {s['jumlah_post']} post — disimpan {s['total_saved']} · "
          f"dibagikan {s['total_shares']} · komentar {s['total_comments']}")

    print(f"\n{'PERINGKAT JANGKAUAN':-<86}")
    print(f"{'#':<3}{'Tanggal':<17}{'Jenis':<6}{'Reach':>7}{'Views':>7}"
          f"{'Simpan':>7}{'Like':>6}{'Lewati':>8}  Judul")
    for i, r in enumerate(sorted(rows, key=lambda x: -x["reach"]), 1):
        sk = f"{r['skip']:.1f}%" if r.get("skip") is not None else "—"
        print(f"{i:<3}{r['tanggal']:<17}{r['jenis']:<6}{r['reach']:>7}{r['views']:>7}"
              f"{r['saved']:>7}{r['likes']:>6}{sk:>8}  {r['judul'][:26]}")


def banding(baru: dict, lama: dict):
    print(f"\n{'PERBANDINGAN DENGAN SNAPSHOT SEBELUMNYA':-<86}")
    print(f"Snapshot lama: {lama['dibuat']}")
    for k, label in [("follower", "Follower"), ("reach_median", "Jangkauan median"),
                     ("reach_median_reel", "Jangkauan median Reel"),
                     ("total_saved", "Total disimpan"),
                     ("total_comments", "Total komentar")]:
        a, b = lama["ringkasan"].get(k, 0), baru["ringkasan"].get(k, 0)
        selisih = b - a
        tanda = "naik" if selisih > 0 else ("turun" if selisih < 0 else "tetap")
        print(f"  {label:<24} {a:>7} → {b:>7}  ({tanda} {abs(selisih)})")


def main():
    args = [a for a in sys.argv[1:]]
    mau_banding = "--banding" in args
    args = [a for a in args if not a.startswith("--")]
    jumlah = int(args[0]) if args else 25

    token = ambil_token()
    print(f"Mengambil {jumlah} media terakhir…")
    prof = get(token, IG_ID, fields="followers_count,media_count")
    rows = kumpulkan(token, jumlah)
    s = ringkas(rows, prof.get("followers_count", 0))
    cetak(rows, s)

    os.makedirs(DATA_DIR, exist_ok=True)
    snap = {"dibuat": datetime.now(WIB).strftime("%Y-%m-%d %H:%M WIB"),
            "ringkasan": s, "media": rows}

    if mau_banding:
        lama = sorted(f for f in os.listdir(DATA_DIR) if f.startswith("ig_"))
        if lama:
            with open(os.path.join(DATA_DIR, lama[-1])) as f:
                banding(snap, json.load(f))
        else:
            print("\n(Belum ada snapshot lama untuk dibandingkan.)")

    nama = f"ig_{datetime.now(WIB).strftime('%Y%m%d_%H%M')}.json"
    with open(os.path.join(DATA_DIR, nama), "w") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    print(f"\nSnapshot disimpan: instagram/data/{nama}")


if __name__ == "__main__":
    main()
