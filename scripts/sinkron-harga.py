#!/usr/bin/env python3
"""Salin harga resmi RR Hair Care (~/RRHairCare/post/harga.json) → netlify/lib/harga-resmi.json.

Kenapa (16 Okt 2026): harga di website diisi lewat panel admin (Netlify Blobs) dan sempat beda dengan harga.json
yang dipakai DM, IG, dan kasir (Smoothing Short web Rp350.000 vs resmi "mulai Rp250.000"; Paket C Rp100.000 vs Rp105.000).
Fungsi /api/pricelist dan prerender kini menimpa harga layanan yang NAMANYA sama persis dengan harga resmi,
jadi website selalu ikut harga.json. Layanan yang hanya ada di admin (nail art, dll.) tidak disentuh.

  python3 scripts/sinkron-harga.py      # lalu commit + push main (deploy)
"""
import json, os

SUMBER = os.path.expanduser("~/RRHairCare/post/harga.json")
TUJUAN = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "netlify", "lib", "harga-resmi.json")
# Keterangan yang sudah dikonfirmasi pemilik (07 Okt 2026, juga di ~/konten/otomatis/dm/pedoman.md).
KETERANGAN = {"Smoothing Short": "Harga mulai — menyesuaikan panjang & ketebalan rambut"}
# Perkiraan durasi = ~/konten/otomatis/dm/pengetahuan.md bagian B (pemilik 07 Okt 2026: "nggak jauh beda" dengan durasi asli).
# Durasi dari POS di panel admin banyak yang isian bawaan "5min" (Colouring, Smoothing Short) → menyesatkan pelanggan.
POTONG, CATOK, RAWAT = "±30–60 mnt", "±30–45 mnt", "±45–60 mnt"
DURASI = {
    "Haircut Layer Modern": POTONG, "Haircut Oval Layer": POTONG, "Haircut Yongen": POTONG, "Short Bob Cut": POTONG,
    "Gunting Rapi": POTONG, "Cutting styling": POTONG, "Cut Bangs": "±15 mnt",
    "Hair Styling (Catok)": CATOK, "Spiral Hair Styling": CATOK, "Spiral Extention": CATOK, "Catok Blow Extention": CATOK,
    "Hair Wash": "±15–20 mnt",
    "Creambath Inaura": RAWAT, "Creambath Makarizo": RAWAT, "Jasa Hairmask & Creambath": RAWAT, "Hairmask Keratin Inaura": RAWAT,
    "Hairmask CBD / KERATIN": RAWAT, "Hairmask Chocolate": RAWAT, "Hairmask Matrix": RAWAT, "Hairmask Biolage": RAWAT,
    "Hair mask Strawbery": RAWAT, "Hairmask Ketombe": RAWAT, "Scrub Scalp": RAWAT,
    "Smoothing Short": "±2–3 jam", "Smoothing Medium": "±3–4 jam", "Smoothing Long": "±4–6 jam",
    "Colouring": "±1,5–3 jam", "Highlight": "±2–4 jam", "Full Bleaching": "±3–5 jam",
    "Massage Body 60 Menit": "60 mnt", "Body Scrub 40 Menit": "40 mnt", "Totok Wajah 30menit": "30 mnt", "Facial Treatment": "±60 mnt",
}

harga = {k: int(v) for k, v in json.load(open(SUMBER)).items() if not k.startswith("_")}
isi = {"_catatan": "DIBUAT OTOMATIS oleh scripts/sinkron-harga.py dari ~/RRHairCare/post/harga.json — jangan disunting tangan.",
       "harga": harga, "keterangan": KETERANGAN, "durasi": DURASI}
lama = open(TUJUAN).read() if os.path.exists(TUJUAN) else ""
baru = json.dumps(isi, ensure_ascii=False, indent=2) + "\n"
if baru != lama:
    open(TUJUAN, "w").write(baru)
    print(f"harga-resmi.json diperbarui: {len(harga)} layanan")
else:
    print("harga-resmi.json sudah sama")
