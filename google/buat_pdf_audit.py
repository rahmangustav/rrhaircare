"""Bangun PDF laporan audit YouTube RR Hair Care untuk tim konten.

Jalankan:  .venv/bin/python buat_pdf_audit.py

Baca snapshot data/audit_20260715.json → render 5 diagram (matplotlib)
→ susun PDF A4 (fpdf2) ke ~/rr-haircare-shop/Audit-YouTube-RRHairCare-Juli2026.pdf

Palet mengikuti brand toko (karamel #A0651E — tervalidasi kontras/CVD di atas
putih); merah #D03B3B hanya sebagai penanda masalah di chart top-10, selalu
didampingi label langsung + legend (secondary encoding).
"""
import json
import re
import statistics
from collections import Counter
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager
from fpdf import FPDF

ROOT = Path(__file__).parent
DATA = json.load(open(ROOT / "data" / "audit_20260715.json"))
CHART_DIR = ROOT / "data" / "charts"
CHART_DIR.mkdir(exist_ok=True)
PDF_OUT = ROOT.parent / "Audit-YouTube-RRHairCare-Juli2026.pdf"

FONT_DIR = Path("/home/rr/moovon-finance/fonts")

# ---- palet (light, permukaan putih; karamel tervalidasi ≥3:1, band, chroma) ----
CARAMEL = "#A0651E"   # hue data utama (single series)
TRACK = "#EBDCC8"     # track meter — step muda dari ramp karamel (chrome)
FLAG = "#D03B3B"      # penanda masalah (hanya chart top-10, dgn label+legend)
DEEMPH = "#8A8378"    # abu de-emphasis (hanya chart top-10)
INK = "#1A1A1A"
MUTED = "#6B6560"
HAIR = "#E5E1DA"      # gridline hairline solid
AXIS = "#C9C2B8"
CREAM = "#F7F3EE"     # panel layout (bukan chart)

INK_RGB = (26, 26, 26)
MUTED_RGB = (107, 101, 96)
CARAMEL_RGB = (160, 101, 30)
CREAM_RGB = (247, 243, 238)
HAIR_RGB = (229, 225, 218)
FLAG_RGB = (208, 59, 59)
GOOD_RGB = (12, 131, 12)

for f in ["Archivo-Regular.ttf", "Archivo-Medium.ttf", "Archivo-SemiBold.ttf", "Archivo-Black.ttf"]:
    font_manager.fontManager.addfont(str(FONT_DIR / f))
plt.rcParams.update({
    "font.family": "Archivo",
    "figure.facecolor": "white",
    "axes.facecolor": "white",
    "axes.edgecolor": AXIS,
    "axes.linewidth": 0.8,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "text.color": INK,
    "axes.labelcolor": MUTED,
    "font.size": 10,
})


def bersih(s: str) -> str:
    """Buang emoji/glyph di luar cakupan Archivo supaya PDF & chart bersih."""
    s = re.sub(r"[^\x20-\x7EÀ-ɏ–—‘’“”…]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def rb(n) -> str:
    return f"{n:,}".replace(",", ".")


def no_spines(ax, keep_bottom=True):
    for side in ["top", "right", "left"]:
        ax.spines[side].set_visible(False)
    ax.spines["bottom"].set_visible(keep_bottom)
    ax.tick_params(length=0)


# =====================  OLAH DATA  =====================
rows = []
for v in DATA["videos"]:
    s, stt, su = v["snippet"], v.get("statistics", {}), v["status"]
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", v["contentDetails"].get("duration") or "PT0S")
    dur = sum(int(x or 0) * k for x, k in zip(m.groups(), (3600, 60, 1))) if m else 0
    rows.append({
        "title": s["title"], "date": s["publishedAt"][:10], "dur": dur,
        "views": int(stt.get("viewCount", 0)),
        "priv": su["privacyStatus"], "desc": s.get("description", ""),
        "lang": s.get("defaultAudioLanguage"), "tags": len(s.get("tags", [])),
    })
pub = [r for r in rows if r["priv"] == "public"]
shorts = [r for r in pub if r["dur"] <= 62]

med = lambda g: int(statistics.median([r["views"] for r in g])) if g else 0
median_periode = [
    ("2024", med([r for r in shorts if "2024-01" <= r["date"] < "2025-01"])),
    ("Jul-Des 2025", med([r for r in shorts if "2025-07" <= r["date"] < "2026-01"])),
    ("2026 (s.d. Jul)", med([r for r in shorts if r["date"] >= "2026-01"])),
]

bulan_keys = [f"2025-{m:02d}" for m in range(7, 13)] + [f"2026-{m:02d}" for m in range(1, 8)]
per_bulan = Counter(r["date"][:7] for r in pub)
upload_bulanan = [(k, per_bulan.get(k, 0)) for k in bulan_keys]

views_total = sum(r["views"] for r in pub)
views_shorts = sum(r["views"] for r in shorts)
share_shorts = 100 * views_shorts / views_total
med_fmt = {
    "Shorts (<= 1 mnt)": med(shorts),
    "1-3 mnt": med([r for r in pub if 62 < r["dur"] <= 180]),
    "> 3 mnt": med([r for r in pub if r["dur"] > 180]),
}

DATE_TITLE = re.compile(r"\d{1,2} \w+ \d{4}")
top10 = sorted(pub, key=lambda r: -r["views"])[:10]
datish = [r for r in pub if DATE_TITLE.fullmatch(r["title"])]

n = len(pub)
meta = [
    ("Deskripsi ada link situs/booking", sum(1 for r in pub if "rrhaircare.id" in r["desc"].lower())),
    ("Video pakai tags", sum(1 for r in pub if r["tags"] > 0)),
    ("Deskripsi ada nomor WhatsApp", sum(1 for r in pub if re.search(r"wa\.me|whatsapp|0813", r["desc"], re.I))),
    ("Deskripsi tidak kosong", sum(1 for r in pub if r["desc"].strip())),
    ("Bahasa audio diset Indonesia", sum(1 for r in pub if r["lang"] == "id")),
]

# =====================  DIAGRAM  =====================

# -- 1. Momentum: median views per Short per periode --
fig, ax = plt.subplots(figsize=(6.6, 2.9), dpi=220)
labels = [p[0] for p in median_periode]
vals = [p[1] for p in median_periode]
bars = ax.bar(labels, vals, width=0.42, color=CARAMEL, zorder=3)
for b, v in zip(bars, vals):
    ax.text(b.get_x() + b.get_width() / 2, v + max(vals) * 0.03, rb(v),
            ha="center", va="bottom", fontsize=13, fontweight="bold", color=INK)
ax.text(2, vals[2] * 0.5, f"{vals[2] / max(vals[0], 1):.0f}x lipat\nvs 2024",
        ha="center", va="center", fontsize=9.5, color="white", fontweight="bold", linespacing=1.4)
ax.set_ylim(0, max(vals) * 1.18)
ax.set_yticks([])
no_spines(ax)
fig.tight_layout(pad=0.4)
fig.savefig(CHART_DIR / "1_momentum.png", bbox_inches="tight")
plt.close(fig)

# -- 2. Upload per bulan --
fig, ax = plt.subplots(figsize=(6.6, 2.7), dpi=220)
xl = [k[5:7] + "\n'" + k[2:4] for k, _ in upload_bulanan]
cnt = [c for _, c in upload_bulanan]
ax.grid(axis="y", color=HAIR, linewidth=0.8, zorder=0)
bars = ax.bar(range(len(cnt)), cnt, width=0.5, color=CARAMEL, zorder=3)
for i, c in enumerate(cnt):
    if c == max(cnt) or i == len(cnt) - 1:
        ax.text(i, c + 1.2, str(c), ha="center", va="bottom", fontsize=10, fontweight="bold", color=INK)
    if c == 0:
        ax.text(i, 1.2, "0", ha="center", va="bottom", fontsize=10, fontweight="bold", color=MUTED)
ax.set_xticks(range(len(cnt)), xl, fontsize=8)
ax.set_yticks([0, 10, 20, 30, 40])
ax.set_ylim(0, max(cnt) * 1.16)
no_spines(ax)
fig.tight_layout(pad=0.4)
fig.savefig(CHART_DIR / "2_upload.png", bbox_inches="tight")
plt.close(fig)

# -- 3. Meter: pangsa views dari Shorts --
fig, ax = plt.subplots(figsize=(6.6, 0.72), dpi=220)
ax.barh([0], [100], height=0.52, color=TRACK, zorder=2)
ax.barh([0], [share_shorts], height=0.52, color=CARAMEL, zorder=3)
ax.text(share_shorts / 2, 0, f"Shorts  {share_shorts:.0f}%".replace(".", ","),
        ha="center", va="center", fontsize=12, fontweight="bold", color="white")
ax.text(101.2, 0, "sisanya video\nbiasa (6%)", ha="left", va="center", fontsize=8, color=MUTED, linespacing=1.3)
ax.set_xlim(0, 118)
ax.set_ylim(-0.5, 0.5)
ax.axis("off")
fig.tight_layout(pad=0.2)
fig.savefig(CHART_DIR / "3_format.png", bbox_inches="tight")
plt.close(fig)

# -- 4. Top-10 video: emphasis judul-tanggal --
fig, ax = plt.subplots(figsize=(6.9, 3.6), dpi=220)
tt, vv, cc = [], [], []
for r in top10:
    flagged = bool(DATE_TITLE.fullmatch(r["title"]))
    t = bersih(r["title"])
    t = (t[:44] + "…") if len(t) > 45 else t
    tt.append(t or "(tanpa judul)")
    vv.append(r["views"])
    cc.append(FLAG if flagged else DEEMPH)
ypos = range(len(tt))[::-1]
ax.barh(list(ypos), vv, height=0.55, color=cc, zorder=3)
for y, v in zip(ypos, vv):
    ax.text(v + 40, y, rb(v), va="center", ha="left", fontsize=9, color=INK)
ax.set_yticks(list(ypos), tt, fontsize=8.6)
ax.set_xlim(0, max(vv) * 1.14)
ax.set_xticks([])
no_spines(ax, keep_bottom=False)
import matplotlib.patches as mpatches
ax.legend(handles=[
    mpatches.Patch(color=FLAG, label="Judul default — cuma tanggal"),
    mpatches.Patch(color=DEEMPH, label="Judul normal"),
], loc="lower left", bbox_to_anchor=(0, 1.01), ncols=2, frameon=False,
    fontsize=8.6, handlelength=1.2, columnspacing=1.4)
fig.tight_layout(pad=0.4)
fig.savefig(CHART_DIR / "4_top10.png", bbox_inches="tight")
plt.close(fig)

# -- 5. Meter metadata: n dari 132 --
fig, ax = plt.subplots(figsize=(6.9, 2.5), dpi=220)
labels5 = [m[0] for m in meta]
vals5 = [m[1] for m in meta]
ypos = range(len(meta))[::-1]
ax.barh(list(ypos), [n] * len(meta), height=0.5, color=TRACK, zorder=2)
ax.barh(list(ypos), vals5, height=0.5, color=CARAMEL, zorder=3)
for y, v in zip(ypos, vals5):
    ax.text(n + 2.5, y, f"{v} / {n}", va="center", ha="left", fontsize=9.5,
            color=INK, fontweight="bold")
ax.set_yticks(list(ypos), labels5, fontsize=9)
ax.set_xlim(0, n * 1.18)
ax.set_xticks([])
no_spines(ax, keep_bottom=False)
fig.tight_layout(pad=0.4)
fig.savefig(CHART_DIR / "5_meta.png", bbox_inches="tight")
plt.close(fig)

print("✅ 5 diagram dirender ke", CHART_DIR)

# =====================  PDF  =====================
W, MARG = 210, 16
CW = W - 2 * MARG  # lebar konten 178mm


class PDF(FPDF):
    def footer(self):
        self.set_y(-13)
        self.set_draw_color(*HAIR_RGB)
        self.set_line_width(0.2)
        self.line(MARG, self.get_y(), W - MARG, self.get_y())
        self.set_y(-10)
        self.set_font("ArchM", size=7.5)
        self.set_text_color(*MUTED_RGB)
        self.cell(0, 5, "Audit Channel YouTube RR Hair Care — 15 Juli 2026", align="L")
        self.cell(0, 5, f"hal. {self.page_no()}/{{nb}}", align="R")


pdf = PDF("P", "mm", "A4")
pdf.alias_nb_pages()
pdf.set_auto_page_break(True, margin=18)
pdf.set_margins(MARG, 14, MARG)
pdf.add_font("Arch", fname=str(FONT_DIR / "Archivo-Regular.ttf"))
pdf.add_font("ArchM", fname=str(FONT_DIR / "Archivo-Medium.ttf"))
pdf.add_font("ArchSB", fname=str(FONT_DIR / "Archivo-SemiBold.ttf"))
pdf.add_font("ArchB", fname=str(FONT_DIR / "Archivo-Black.ttf"))


def body(txt, size=9.5, h=4.9, color=INK_RGB, font="Arch"):
    pdf.set_font(font, size=size)
    pdf.set_text_color(*color)
    pdf.multi_cell(CW, h, txt)


def section(num, title):
    pdf.ln(2)
    y = pdf.get_y()
    pdf.set_fill_color(*CARAMEL_RGB)
    pdf.rect(MARG, y + 0.6, 7.5, 7.5, style="F")
    pdf.set_xy(MARG, y + 0.6)
    pdf.set_font("ArchB", size=11)
    pdf.set_text_color(255, 255, 255)
    pdf.cell(7.5, 7.5, str(num), align="C")
    pdf.set_xy(MARG + 10.5, y)
    pdf.set_font("ArchB", size=13)
    pdf.set_text_color(*INK_RGB)
    pdf.cell(0, 9, title)
    pdf.ln(11)


def takeaway(txt):
    pdf.ln(1)
    x, y = MARG, pdf.get_y()
    pdf.set_font("ArchSB", size=9.5)
    lines = pdf.multi_cell(CW - 10, 5, txt, dry_run=True, output="LINES")
    h = len(lines) * 5 + 5
    pdf.set_fill_color(*CREAM_RGB)
    pdf.rect(x, y, CW, h, style="F")
    pdf.set_fill_color(*CARAMEL_RGB)
    pdf.rect(x, y, 1.6, h, style="F")
    pdf.set_xy(x + 5, y + 2.5)
    pdf.set_text_color(*INK_RGB)
    pdf.multi_cell(CW - 10, 5, txt)
    pdf.set_y(y + h + 3)


def chart(png, w=CW):
    x = MARG + (CW - w) / 2
    pdf.image(str(CHART_DIR / png), x=x, w=w)
    pdf.ln(2)


# ---------- HALAMAN 1 ----------
pdf.add_page()
y = pdf.get_y()
pdf.set_fill_color(*CREAM_RGB)
pdf.rect(MARG, y, CW, 34, style="F")
pdf.set_xy(MARG + 7, y + 6)
pdf.set_font("ArchSB", size=9)
pdf.set_text_color(*CARAMEL_RGB)
pdf.cell(0, 5, "R R   H A I R   C A R E")
pdf.set_xy(MARG + 7, y + 12)
pdf.set_font("ArchB", size=21)
pdf.set_text_color(*INK_RGB)
pdf.cell(0, 9, "Audit Channel YouTube")
pdf.set_xy(MARG + 7, y + 22)
pdf.set_font("ArchM", size=9.5)
pdf.set_text_color(*MUTED_RGB)
pdf.cell(0, 5, "Untuk tim konten kreator  ·  15 Juli 2026  ·  data resmi YouTube API (@rrhaircareofficial)")
pdf.set_y(y + 40)

body("Kabar baiknya: channel kita sedang naik daun — video baru sekarang rata-rata ditonton "
     "hampir 20 kali lipat dibanding 2024, tanpa iklan. Kabar buruknya: hampir semua hasil itu "
     "terbuang, karena tidak ada satu pun video yang mengarahkan penonton ke booking, daftar "
     "harga, atau WhatsApp. Laporan ini merangkum 6 temuan dari 132 video publik, plus rencana "
     "aksi yang bisa langsung dikerjakan.", size=10, h=5.4)
pdf.ln(2)

# KPI row
tiles = [
    ("Subscriber", "333", "per 15 Jul 2026"),
    ("Total views", "85.020", "sepanjang channel"),
    ("Video publik", "132", "116 di antaranya Shorts"),
    ("Views dari Shorts", "94%", "Shorts = mesin channel"),
]
tw, th, gap = (CW - 3 * 4) / 4, 24, 4
x0, y0 = MARG, pdf.get_y()
for i, (lab, val, sub) in enumerate(tiles):
    x = x0 + i * (tw + gap)
    pdf.set_fill_color(*CREAM_RGB)
    pdf.rect(x, y0, tw, th, style="F")
    pdf.set_xy(x + 3.5, y0 + 3.5)
    pdf.set_font("ArchM", size=7.6)
    pdf.set_text_color(*MUTED_RGB)
    pdf.cell(tw - 7, 3.6, lab)
    pdf.set_xy(x + 3.5, y0 + 8)
    pdf.set_font("ArchSB", size=17)
    pdf.set_text_color(*INK_RGB)
    pdf.cell(tw - 7, 8, val)
    pdf.set_xy(x + 3.5, y0 + 17)
    pdf.set_font("Arch", size=7)
    pdf.set_text_color(*MUTED_RGB)
    pdf.cell(tw - 7, 3.4, sub)
pdf.set_y(y0 + th + 6)

section(1, "Momentum sedang naik — jangan disia-siakan")
body("Median views per Short (angka tengah, bukan rata-rata yang bisa terkatrol satu video "
     "viral) melonjak dari 78 pada 2024 menjadi 1.506 pada 2026. Artinya algoritma YouTube "
     "makin sering merekomendasikan konten kita ke orang baru.")
pdf.ln(1.5)
chart("1_momentum.png", w=150)
takeaway("Takeaway: momentum algoritma sudah di tangan. Yang menentukan 6 bulan ke depan "
         "adalah konsistensi upload dan jalur booking di tiap video.")

# ---------- HALAMAN 2 ----------
pdf.add_page()
section(2, "Konsistensi upload sempat putus total")
body("Agustus 2025 kita sanggup 43 upload sebulan, lalu merosot dan dua kali berhenti total "
     "(Maret dan Mei 2026 = nol upload). Ironisnya justru di 2026 performa per video sedang "
     "terbaik-baiknya. Channel yang berhenti posting membuat algoritma ikut berhenti "
     "merekomendasikan.")
pdf.ln(1.5)
chart("2_upload.png", w=168)
takeaway("Target baru: 3-4 Shorts per minggu, stabil. Lebih baik 3 per minggu selamanya "
         "daripada 43 sebulan lalu menghilang dua bulan.")

section(3, "Shorts adalah mesin channel ini")
body(f"{share_shorts:.0f}% dari seluruh views channel datang dari Shorts ({rb(views_shorts)} "
     f"views). Median views per video juga jauh lebih tinggi: Shorts {rb(med_fmt['Shorts (<= 1 mnt)'])} "
     f"· video 1-3 menit {rb(med_fmt['1-3 mnt'])} · video panjang {rb(med_fmt['> 3 mnt'])}. "
     "Kesimpulannya jelas: format utama kita ya Shorts — video panjang cukup sesekali untuk "
     "konten yang memang butuh durasi (mis. tutorial atau tur salon).")
pdf.ln(1.5)
chart("3_format.png", w=168)

# ---------- HALAMAN 3 ----------
pdf.add_page()
section(4, "Video terbaik kita malah tidak berjudul")
body("Ada 14 video yang judulnya cuma tanggal (contoh: \"21 Februari 2026\") — judul bawaan "
     "upload dari HP yang lupa diganti. Total 18.124 views, dan 4 dari 10 video "
     "terpopuler ada di kelompok ini. Kontennya terbukti disukai; judulnya tidak menjual "
     "apa-apa. Penonton (dan Google) tidak tahu video itu tentang smoothing, coloring, atau "
     "apa pun.")
pdf.ln(1.5)
chart("4_top10.png", w=172)
takeaway("Aksi: 14 judul ini akan diganti judul deskriptif (layanan + hasil). Mulai sekarang: "
         "JANGAN pernah upload tanpa mengganti judul default.")

section(5, "Kebocoran konversi: penonton tidak diarahkan ke mana-mana")
body("Dari 132 video publik, TIDAK ADA SATU PUN yang menaruh link rrhaircare.id di deskripsi. "
     "57 deskripsi kosong total. Padahal situs kita punya daftar 79 harga layanan dan form "
     "booking. Setiap views yang datang hari ini berakhir buntu.")
pdf.ln(1.5)
chart("5_meta.png", w=172)

# ---------- HALAMAN 4 ----------
pdf.add_page()
section(6, "Pola konten: tiru yang menang, buang yang flop")
colw = (CW - 5) / 2
y0 = pdf.get_y()


def kolom(x, judul, dotc, items):
    pdf.set_fill_color(*CREAM_RGB)
    lines_h = 8.5 + sum(len(pdf.multi_cell(colw - 12, 4.4, "-  " + t, dry_run=True, output="LINES")) * 4.4 + 2.2 for t in items) + 4
    pdf.rect(x, y0, colw, lines_h, style="F")
    pdf.set_xy(x + 4, y0 + 3)
    pdf.set_fill_color(*dotc)
    pdf.ellipse(x + 4, y0 + 4.2, 3, 3, style="F")
    pdf.set_xy(x + 9, y0 + 3)
    pdf.set_font("ArchB", size=10)
    pdf.set_text_color(*INK_RGB)
    pdf.cell(0, 5.5, judul)
    yy = y0 + 10.5
    for t in items:
        pdf.set_xy(x + 4, yy)
        pdf.set_font("Arch", size=8.6)
        pdf.set_text_color(*INK_RGB)
        pdf.multi_cell(colw - 12, 4.4, "-  " + t)
        yy = pdf.get_y() + 2.2
    return y0 + lines_h


menang = [
    "Transformasi hasil layanan (smoothing, keratin, coloring) — selalu ada di jajaran teratas",
    "Caption relatable/curhat: \"Daripada pusing mikirin hidup, mending dibikin relax\" (2.363 views)",
    "Behind-the-scene mimin & tim yang ada kepribadiannya",
    "Ucapan hari besar (Maulid: 1.840 views) — kedekatan dengan warga sekitar",
]
flop = [
    "Hard-sell diskon: \"LAST CALL! Diskon 50%\" = 5 views (terburuk se-channel)",
    "Posting kampanye brand produk yang generik (hashtag Matrix di mana-mana, #rrhaircare malah jarang)",
    "Video tanpa konteks: judul tanggal, deskripsi kosong",
    "Konten di luar tema salon (video musik, dll.) — membingungkan algoritma",
]
h1 = kolom(MARG, "YANG TERBUKTI MENANG", GOOD_RGB, menang)
h2 = kolom(MARG + colw + 5, "YANG TERBUKTI FLOP", FLAG_RGB, flop)
pdf.set_y(max(h1, h2) + 5)

section(7, "Rencana aksi")
body("Bagian A dikerjakan lewat API oleh tim digital (sekali jalan, semua video lama ikut "
     "rapi). Bagian B adalah SOP harian tim konten mulai hari ini.", size=9.5)
pdf.ln(1)
pdf.set_font("ArchSB", size=10)
pdf.set_text_color(*CARAMEL_RGB)
pdf.cell(0, 6, "A. Perbaikan massal video lama (otomatis)")
pdf.ln(6.5)
for t in [
    "Tambah blok deskripsi standar ke semua video: link booking rrhaircare.id, daftar harga, WhatsApp 0813-8629-1552, hashtag #RRHairCare #SalonJakartaUtara.",
    "Ganti judul 14 video \"tanggal\" dengan judul layanan + hasil.",
    "Matikan tanda \"untuk anak-anak\" di 4 video (komentar hidup lagi).",
    "Set bahasa audio Indonesia di 18 video yang belum.",
    "Sembunyikan 3 video lama di luar tema + playlist non-salon.",
    "Perbarui deskripsi channel: alamat Koja, jam buka, WA, link situs.",
]:
    pdf.set_font("Arch", size=9)
    pdf.set_text_color(*INK_RGB)
    pdf.multi_cell(CW, 4.7, "-  " + t)
    pdf.ln(0.8)
pdf.ln(1.5)
pdf.set_font("ArchSB", size=10)
pdf.set_text_color(*CARAMEL_RGB)
pdf.cell(0, 6, "B. SOP tim konten — checklist tiap upload baru")
pdf.ln(7)
x, y = MARG, pdf.get_y()
sop = [
    "Ritme: 3-4 Shorts/minggu. Formula: transformasi + caption relatable. Tanpa hard-sell.",
    "Judul jelas menyebut layanan & hasil (bukan tanggal, bukan nama produk).",
    "Deskripsi pakai template resmi (link booking + harga + WA + hashtag standar).",
    "Ajakan ringan di akhir video: \"booking lewat link di deskripsi ya\".",
    "Set bahasa audio Indonesia; JANGAN centang \"untuk anak-anak\".",
]
pdf.set_fill_color(*CREAM_RGB)
hh = 6 + sum(len(pdf.multi_cell(CW - 14, 4.7, t, dry_run=True, output="LINES")) * 4.7 + 1.6 for t in sop)
pdf.rect(x, y, CW, hh, style="F")
pdf.set_fill_color(*CARAMEL_RGB)
pdf.rect(x, y, 1.6, hh, style="F")
yy = y + 3
for i, t in enumerate(sop, 1):
    pdf.set_xy(x + 5, yy)
    pdf.set_font("ArchSB", size=9)
    pdf.set_text_color(*CARAMEL_RGB)
    pdf.cell(6, 4.7, f"{i}.")
    pdf.set_xy(x + 11, yy)
    pdf.set_font("Arch", size=9)
    pdf.set_text_color(*INK_RGB)
    pdf.multi_cell(CW - 14, 4.7, t)
    yy = pdf.get_y() + 1.6

pdf.output(str(PDF_OUT))
print(f"✅ PDF jadi: {PDF_OUT}")
