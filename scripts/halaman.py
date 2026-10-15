#!/usr/bin/env python3
"""Halaman SEO per layanan RR Hair Care → public/layanan/<slug>.html (URL rrhaircare.id/layanan/<slug>).

Isi hanya fakta yang sudah dikonfirmasi pemilik: harga dari ~/RRHairCare/post/harga.json, isi paket & perkiraan durasi
dari ~/konten/otomatis/dm/pengetahuan.md (A, A2, B), penjelasan & saran perawatan dari bagian C–D. Aturan brand
(skill rr-brand-aman): hanya Inaura yang disarankan, tanpa promo/diskon, tanpa janji hasil, tanpa testimoni.
sitemap.xml diisi oleh scripts/prerender.js (membaca public/layanan/*.html).

  python3 scripts/halaman.py      # bangun ulang (lalu commit + push main = deploy). Jalankan lagi setelah harga.json berubah.
"""
import html, json, os

AKAR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KELUAR = os.path.join(AKAR, "public", "layanan")
H = {k: int(v) for k, v in json.load(open(os.path.expanduser("~/RRHairCare/post/harga.json"))).items() if not k.startswith("_")}
SITUS = "https://rrhaircare.id"
WA = "6281386291552"
WA_TAMPIL = "0813-8629-1552"
ALAMAT = [("Salon 1", "Jl. B Raya No. 6, RT.8/RW.5, Rawabadak Utara, Koja, Jakarta Utara 14230"),
          ("Salon 2 (RR Hair Care Premium)", "Jl. B Raya No. 55B, RT.5/RW.9, Rawabadak Utara, Koja, Jakarta Utara 14230")]
CATATAN_DURASI = "Perkiraan durasi — tergantung panjang, ketebalan & kondisi rambut; kepastiannya dari capster saat booking."


def rp(n):
    return "Rp" + f"{int(n):,}".replace(",", ".")


def e(s):
    return html.escape(str(s), quote=True)


def baris(nama, durasi="", label=None, isi=None, mulai=False, satuan=""):
    """Satu baris tabel harga; nama = kunci harga.json (wajib ada, kalau tidak build berhenti)."""
    if nama not in H:
        raise SystemExit(f"'{nama}' tidak ada di harga.json — jangan dikarang")
    harga = ("mulai " if mulai else "") + rp(H[nama]) + satuan
    return dict(nama=label or nama, harga=harga, durasi=durasi, isi=isi or "", angka=H[nama])


def wa_link(teks):
    from urllib.parse import quote
    return f"https://wa.me/{WA}?text={quote(teks)}"


POTONG, CATOK, RAWAT = "±30–60 mnt", "±30–45 mnt", "±45–60 mnt"

HAL = [
    dict(slug="smoothing-rambut-jakarta-utara", kicker="Smoothing",
         title="Smoothing Rambut di Koja, Jakarta Utara — Harga Mulai Rp250.000 | RR Hair Care",
         desc="Smoothing rambut di RR Hair Care Koja, Jakarta Utara: Short mulai Rp250.000, Medium Rp300.000, Long Rp400.000. Buka setiap hari 09.00–21.00, dua salon di Jl. B Raya.",
         h1="Smoothing rambut di Koja, Jakarta Utara",
         intro="Smoothing meluruskan dan melembutkan rambut supaya lebih rapi dan mudah diatur, dengan hasil yang tetap natural — tidak kaku. "
               "Harga dibagi menurut panjang rambut dan tertulis di bawah ini, jadi kamu tahu biayanya sebelum duduk di kursi.",
         tabel=lambda: [baris("Smoothing Short", "±2–3 jam", "Smoothing Short (rambut pendek)", mulai=True),
                        baris("Smoothing Medium", "±3–4 jam", "Smoothing Medium (sebahu)"),
                        baris("Smoothing Long", "±4–6 jam", "Smoothing Long (panjang)")],
         poin=["Datang dengan rambut kering dan bersih dari minyak atau produk styling.",
               "Ceritakan riwayat kimia rambut (pernah dicat, di-bleach, atau di-smoothing) supaya capster bisa menilai kondisinya.",
               "Setelah smoothing: jangan keramas ±2–3 hari, jangan diikat/dijepit atau diselipkan ke telinga ±3 hari.",
               "Pakai sampo yang lembut, rutin hairmask, dan kurangi catok panas supaya hasilnya awet.",
               "Smoothing biasanya bertahan beberapa bulan; akar yang tumbuh baru nanti bisa dirapikan lagi."],
         faq=[("Berapa harga smoothing di RR Hair Care?", f"Smoothing Short mulai {rp(H['Smoothing Short'])}, Smoothing Medium {rp(H['Smoothing Medium'])}, Smoothing Long {rp(H['Smoothing Long'])}. Harga Short bisa naik menyesuaikan panjang dan ketebalan rambut — selalu disampaikan sebelum pengerjaan dimulai."),
              ("Berapa lama proses smoothing?", "Biasanya sekitar 2–3 jam untuk rambut pendek, 3–4 jam untuk rambut sebahu, dan 4–6 jam untuk rambut panjang atau tebal."),
              ("Apa bedanya smoothing dan rebonding?", "Smoothing membuat rambut lurus dan lembut dengan hasil natural. Rebonding hasilnya lebih lurus dan cenderung kaku."),
              ("Boleh smoothing dan coloring di hari yang sama?", "Umumnya disarankan diberi jeda. Capster yang menilai kondisi rambutmu — kirim foto rambut lewat WhatsApp sebelum booking."),
              ("Kapan boleh keramas setelah smoothing?", "Tunggu sekitar 2–3 hari, lalu pakai sampo yang lembut.")],
         wa="Halo RR Hair Care, saya mau booking smoothing."),
    dict(slug="coloring-rambut-jakarta-utara", kicker="Coloring & highlight",
         title="Coloring & Highlight Rambut di Koja, Jakarta Utara | RR Hair Care",
         desc="Coloring rambut Rp250.000, highlight Rp300.000, full bleaching Rp250.000 di RR Hair Care Koja, Jakarta Utara. Harga tertulis, buka setiap hari 09.00–21.00.",
         h1="Coloring & highlight rambut di Koja, Jakarta Utara",
         intro="Coloring mewarnai seluruh rambut; highlight memberi warna lebih terang pada sebagian helai. Untuk warna terang, rambut biasanya "
               "perlu di-bleaching dulu untuk mengangkat warna aslinya — dan setelahnya butuh perawatan ekstra.",
         tabel=lambda: [baris("Colouring", "±1,5–3 jam", "Coloring (seluruh rambut)"),
                        baris("Highlight", "±2–4 jam"),
                        baris("Full Bleaching", "±3–5 jam (dengan warna)")],
         poin=["Datang dengan rambut kering dan bersih; ceritakan riwayat kimia rambut sebelumnya.",
               "Kirim foto rambut sekarang dan contoh warna yang kamu mau lewat WhatsApp — capster bisa menilai dulu.",
               "Setelah coloring atau bleaching: tunda keramas ±2–3 hari dan pakai sampo untuk rambut berwarna.",
               "Rutin hairmask dan hindari air kolam berklorin supaya warna tidak cepat pudar.",
               "Di salon kami memakai Inaura; developer Inaura 3% dan 9% juga tersedia di toko online."],
         faq=[("Berapa harga coloring rambut di RR Hair Care?", f"Coloring {rp(H['Colouring'])}, Highlight {rp(H['Highlight'])}, Full Bleaching {rp(H['Full Bleaching'])}."),
              ("Berapa lama proses coloring?", "Biasanya sekitar 1,5–3 jam untuk coloring, 2–4 jam untuk highlight, dan 3–5 jam untuk full bleaching ditambah warna."),
              ("Apa beda coloring dan highlight?", "Coloring mewarnai seluruh rambut. Highlight hanya sebagian helai yang diberi warna lebih terang."),
              ("Kapan boleh keramas setelah coloring?", "Tunda sekitar 2–3 hari, lalu pakai sampo untuk rambut berwarna.")],
         wa="Halo RR Hair Care, saya mau tanya coloring rambut."),
    dict(slug="potong-rambut-wanita-jakarta-utara", kicker="Potong & styling",
         title="Potong Rambut Wanita di Koja, Jakarta Utara — Mulai Rp40.000 | RR Hair Care",
         desc="Potong rambut wanita di RR Hair Care Koja: layer modern, oval layer, yongen Rp50.000, short bob Rp40.000, rapikan ujung Rp30.000. Catok mulai Rp35.000.",
         h1="Potong rambut wanita di Koja, Jakarta Utara",
         intro="Layer modern, oval layer, yongen, short bob, sampai sekadar merapikan ujung atau poni. Ceritakan model yang kamu mau — atau kirim "
               "fotonya — waktu booking, supaya capster bisa menyiapkan.",
         tabel=lambda: [baris("Haircut Layer Modern", POTONG), baris("Haircut Oval Layer", POTONG), baris("Haircut Yongen", POTONG),
                        baris("Short Bob Cut", POTONG), baris("Gunting Rapi", POTONG, "Gunting Rapi (rapikan ujung)"),
                        baris("Cut Bangs", "±15 mnt", "Cut Bangs (poni)"), baris("Cutting styling", POTONG),
                        baris("Hair Styling (Catok)", CATOK), baris("Spiral Hair Styling", CATOK), baris("Hair Wash", "±15–20 mnt")],
         poin=["Bawa atau kirim foto model rambut yang kamu mau — lebih cepat sepakat dengan capster.",
               "Rambut kering, kusam, atau bercabang? Rapikan ujung bisa digabung dengan Hairmask Keratin Inaura atau Creambath Inaura.",
               "Dua salon buka setiap hari 09.00–21.00; booking dan konfirmasi slot lewat WhatsApp."],
         faq=[("Berapa harga potong rambut wanita di RR Hair Care?", f"Haircut Layer Modern, Oval Layer, dan Yongen {rp(H['Haircut Layer Modern'])}; Short Bob {rp(H['Short Bob Cut'])}; rapikan ujung (Gunting Rapi) {rp(H['Gunting Rapi'])}; potong poni {rp(H['Cut Bangs'])}."),
              ("Berapa lama potong rambut?", "Biasanya sekitar 30–60 menit, potong poni sekitar 15 menit."),
              ("Bisa sekalian catok setelah potong?", f"Bisa. Hair Styling (Catok) {rp(H['Hair Styling (Catok)'])}, Spiral Hair Styling {rp(H['Spiral Hair Styling'])}.")],
         wa="Halo RR Hair Care, saya mau booking potong rambut."),
    dict(slug="creambath-hair-spa-jakarta-utara", kicker="Creambath & hair spa",
         title="Creambath & Hair Spa Inaura di Koja, Jakarta Utara — Mulai Rp40.000 | RR Hair Care",
         desc="Creambath Inaura Rp40.000 dan Hairmask Keratin Inaura Rp70.000 di RR Hair Care Koja, Jakarta Utara. Paket perawatan rambut mulai Rp100.000.",
         h1="Creambath & hair spa di Koja, Jakarta Utara",
         intro="Creambath adalah perawatan krim dengan pijat kepala — bikin rileks dan rambut lebih lembut. Hairmask adalah masker rambut untuk "
               "nutrisi; keratin membuat rambut halus dan berkilau, tapi bukan pelurusan permanen. Di kursi salon kami memakai Inaura.",
         tabel=lambda: [baris("Creambath Inaura", RAWAT), baris("Hairmask Keratin Inaura", RAWAT),
                        baris("Hairmask Chocolate", RAWAT, "Hairmask Chocolate Inaura"), baris("Hair mask Strawbery", RAWAT, "Hairmask Strawberry"),
                        baris("Hairmask Ketombe", RAWAT), baris("Scrub Scalp", RAWAT, "Scrub Scalp (kulit kepala)"),
                        baris("Paket A", "", isi="Creambath Inaura + Hair Styling (Catok) + Hairtonik 100 ml + Vitamin Inaura Orange 8 ml"),
                        baris("Paket D", "", isi="Hairmask Chocolate Inaura + Hair Styling (Catok) + Vitamin Inaura Orange 8 ml"),
                        baris("Paket C", "", isi="Hairmask Ketombe + Scrub Scalp + Hair Styling (Catok)")],
         poin=["Rambut kering, kusam, atau bercabang: Hairmask Keratin Inaura atau Creambath Inaura, bisa ditambah rapikan ujung.",
               "Kulit kepala berketombe atau gatal ringan: Hairmask Ketombe dan Scrub Scalp (Paket C). Kalau parah, luka, atau rontok berat, periksakan ke dokter kulit.",
               "Produk Inaura juga bisa dibawa pulang lewat toko online rrhaircare.id/toko."],
         faq=[("Berapa harga creambath di RR Hair Care?", f"Creambath Inaura {rp(H['Creambath Inaura'])}. Hairmask Keratin Inaura {rp(H['Hairmask Keratin Inaura'])}."),
              ("Berapa lama creambath?", "Biasanya sekitar 45–60 menit."),
              ("Apa beda creambath dan hairmask?", "Creambath memakai krim plus pijat kepala supaya rileks. Hairmask adalah masker rambut untuk nutrisi."),
              ("Apa isi paket perawatan rambut?", f"Paket A {rp(H['Paket A'])}: Creambath Inaura + catok + hairtonik + vitamin. Paket D {rp(H['Paket D'])}: Hairmask Chocolate Inaura + catok + vitamin. Paket C {rp(H['Paket C'])}: Hairmask Ketombe + Scrub Scalp + catok.")],
         wa="Halo RR Hair Care, saya mau booking creambath."),
    dict(slug="extension-rambut-jakarta-utara", kicker="Extension",
         title="Pasang Extension Rambut di Jakarta Utara — Rp4.000 per Helai | RR Hair Care",
         desc="Pasang extension rambut di RR Hair Care Koja, Jakarta Utara: Rp4.000 per helai. Coloring extension, catok & spiral extension. Hitung helai lewat WhatsApp.",
         h1="Extension rambut di Koja, Jakarta Utara",
         intro="Mau rambut lebih panjang atau bervolume tanpa menunggu tumbuh? Harga pasang extension dihitung per helai, jadi totalnya "
               "tergantung berapa helai yang kamu butuhkan — kami bantu hitung lewat WhatsApp sebelum datang.",
         tabel=lambda: [baris("Kepang Ext 3.000/Helai", "", "Pasang extension", satuan=" / helai"),
                        baris("Colouring Extension"), baris("Catok Blow Extention", CATOK, "Catok blow extension"),
                        baris("Spiral Extention", CATOK, "Spiral extension")],
         poin=["Total pasang = jumlah helai × Rp4.000. Jumlah helai dihitung bersama capster lewat WhatsApp.",
               "Lama pengerjaan tergantung jumlah helai — biasanya beberapa jam.",
               "Untuk lepas atau servis extension, tanyakan biayanya lewat WhatsApp."],
         faq=[("Berapa harga pasang extension di RR Hair Care?", f"{rp(H['Kepang Ext 3.000/Helai'])} per helai. Total tergantung jumlah helai."),
              ("Berapa lama pasang extension?", "Tergantung jumlah helai — biasanya beberapa jam. Kirim foto rambut dan panjang yang diinginkan lewat WhatsApp."),
              ("Bisa sekalian diwarnai?", f"Bisa. Coloring extension {rp(H['Colouring Extension'])}.")],
         wa="Halo RR Hair Care, saya mau tanya pasang extension."),
    dict(slug="massage-lulur-jakarta-utara", kicker="Massage, lulur & wajah",
         title="Massage Body & Lulur di Koja, Jakarta Utara — Paket Mulai Rp140.000 | RR Hair Care",
         desc="Massage body 60 menit Rp120.000, body scrub Rp100.000, facial Rp100.000, dan paket massage + creambath di RR Hair Care Koja, Jakarta Utara.",
         h1="Massage body, lulur & perawatan wajah di Koja",
         intro="Selain rambut, RR Hair Care melayani massage body, body scrub, dan perawatan wajah — bisa digabung dengan creambath "
               "dalam satu paket supaya sekali datang langsung rileks.",
         tabel=lambda: [baris("Massage Body 60 Menit", "60 mnt"), baris("Body Scrub 40 Menit", "40 mnt"),
                        baris("Facial Treatment", "±60 mnt"), baris("Totok Wajah 30menit", "30 mnt", "Totok Wajah 30 Menit"),
                        baris("Bleaching Badan"), baris("Mandi Susu Oles"),
                        baris("Paket 1", "", isi="Massage Body 60 Menit + Body Scrub 40 Menit"),
                        baris("Paket 2", "", isi="Massage Body 60 Menit + Body Scrub 40 Menit + Creambath Inaura"),
                        baris("Paket 3", "", isi="Massage Body 60 Menit + Creambath Inaura"),
                        baris("Paket 8", "", isi="Facial Treatment + Creambath Inaura"),
                        baris("Paket 9", "", isi="Massage Body 60 Menit + Bleaching Badan")],
         poin=["Mau rileks: Paket 1, 2, 3, atau 9. Fokus wajah: Paket 8.",
               "Sedang hamil, menyusui, punya alergi, atau kondisi kesehatan tertentu? Konsultasikan dulu ke dokter, lalu kabari kami lewat WhatsApp.",
               "Booking dan konfirmasi slot lewat WhatsApp."],
         faq=[("Berapa harga massage di RR Hair Care?", f"Massage Body 60 Menit {rp(H['Massage Body 60 Menit'])}. Body Scrub 40 Menit {rp(H['Body Scrub 40 Menit'])}."),
              ("Apa isi paket massage?", f"Paket 1 {rp(H['Paket 1'])}: massage + body scrub. Paket 2 {rp(H['Paket 2'])}: massage + body scrub + Creambath Inaura. Paket 3 {rp(H['Paket 3'])}: massage + Creambath Inaura. Paket 9 {rp(H['Paket 9'])}: massage + bleaching badan."),
              ("Ada perawatan wajah?", f"Ada. Facial Treatment {rp(H['Facial Treatment'])}, Totok Wajah 30 Menit {rp(H['Totok Wajah 30menit'])}, dan Paket 8 {rp(H['Paket 8'])} (facial + Creambath Inaura).")],
         wa="Halo RR Hair Care, saya mau booking massage."),
]

GAYA = """<style>
  :root{--charcoal:#17140F;--ivory:#FBF8F3;--accent:#7A2E3F;--soft-white:#FFFDFA;--muted:#6E6A64;--line:#E6DFD6;
    --serif:'Fraunces',Georgia,serif;--sans:ui-sans-serif,system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:var(--sans);background:var(--soft-white);color:var(--charcoal);line-height:1.65}
  .bungkus{max-width:760px;margin:0 auto;padding:28px 16px 72px}
  .atas{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:34px}
  .logo{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
  .logo img{height:38px;width:38px;object-fit:contain}
  .logo span{font-family:var(--serif);font-size:1.1rem;font-weight:600;letter-spacing:.06em;white-space:nowrap}
  .atas .tombol{white-space:nowrap;padding:10px 16px;font-size:.8rem}
  .logo em{color:var(--accent);font-style:normal}
  .remah{font-size:.8rem;color:var(--muted);margin-bottom:10px}
  .remah a{color:var(--muted)}
  .kicker{font-size:.78rem;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
  h1{font-family:var(--serif);font-size:clamp(1.7rem,5vw,2.5rem);line-height:1.15;margin-bottom:16px}
  h2{font-family:var(--serif);font-size:1.25rem;font-weight:600;margin:36px 0 12px;padding-top:22px;border-top:1px solid var(--line)}
  h3{font-size:.98rem;font-weight:600;margin:18px 0 6px}
  p,li{font-size:.95rem;color:#3B3733;margin-bottom:12px}
  ul{padding-left:20px} li{margin-bottom:7px}
  a{color:var(--accent)}
  .harga{width:100%;border-collapse:collapse;margin:8px 0 6px}
  .harga td{padding:12px 6px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.95rem}
  .harga td.rp{text-align:right;white-space:nowrap;font-weight:700;color:var(--accent)}
  .harga small{display:block;color:var(--muted);font-size:.8rem;margin-top:2px}
  .kecil{font-size:.8rem;color:var(--muted)}
  .tombol{display:inline-flex;align-items:center;gap:8px;margin:18px 10px 0 0;padding:13px 24px;border-radius:999px;
    background:var(--accent);color:#0B0907;font-size:.9rem;font-weight:700;text-decoration:none}
  .tombol.garis{background:transparent;border:1px solid var(--accent);color:var(--accent)}
  a.tombol{color:#0B0907!important} a.tombol.garis{color:var(--accent)!important}
  .kartu{background:var(--ivory);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:12px 0}
  .kartu p:last-child{margin-bottom:0}
  .lain{display:flex;flex-wrap:wrap;gap:8px;padding:0;list-style:none}
  .lain li{margin:0} .lain a{display:inline-block;padding:8px 14px;border:1px solid var(--line);border-radius:999px;font-size:.85rem;text-decoration:none}
  @media (max-width:420px){.harga td{padding:10px 2px}}
</style>
  <link rel="stylesheet" href="/css/halaman-gelap.css?v=20261006c"/>"""


def halaman(h):
    url = f"{SITUS}/layanan/{h['slug']}"
    rows = h["tabel"]()
    tbl = "\n".join(
        f'      <tr><td>{e(r["nama"])}'
        + (f'<small>{e(r["isi"])}</small>' if r["isi"] else "")
        + (f'<small>{e(r["durasi"])}</small>' if r["durasi"] else "")
        + f'</td><td class="rp">{e(r["harga"])}</td></tr>' for r in rows)
    ada_durasi = any(r["durasi"] for r in rows)
    poin = "\n".join(f"      <li>{e(p)}</li>" for p in h["poin"])
    faq = "\n".join(f"    <h3>{e(q)}</h3>\n    <p>{e(a)}</p>" for q, a in h["faq"])
    alamat = "\n".join(f"      <p><b>{e(n)}</b><br>{e(a)}</p>" for n, a in ALAMAT)
    lain = "\n".join(f'      <li><a href="/layanan/{x["slug"]}">{e(x["kicker"])}</a></li>' for x in HAL if x["slug"] != h["slug"])
    ld = [
        {"@context": "https://schema.org", "@type": "Service", "name": h["h1"], "serviceType": h["kicker"], "url": url,
         "description": h["desc"], "areaServed": {"@type": "City", "name": "Jakarta Utara"},
         "provider": {"@id": f"{SITUS}/#salon", "@type": "HairSalon", "name": "RR Hair Care", "telephone": "+" + WA, "url": SITUS + "/"},
         "offers": [{"@type": "Offer", "name": r["nama"], "price": str(r["angka"]), "priceCurrency": "IDR"} for r in rows]},
        {"@context": "https://schema.org", "@type": "FAQPage",
         "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in h["faq"]]},
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Beranda", "item": SITUS + "/"},
            {"@type": "ListItem", "position": 2, "name": h["kicker"], "item": url}]},
    ]
    ld_html = "\n".join(f'<script type="application/ld+json">{json.dumps(x, ensure_ascii=False)}</script>' for x in ld)
    return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{e(h['title'])}</title>
<meta name="description" content="{e(h['desc'])}"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="RR Hair Care"/>
<meta property="og:locale" content="id_ID"/>
<meta property="og:title" content="{e(h['title'])}"/>
<meta property="og:description" content="{e(h['desc'])}"/>
<meta property="og:url" content="{url}"/>
<meta property="og:image" content="{SITUS}/img/og.jpg"/>
<link rel="icon" href="/favicon.svg" type="image/svg+xml"/>
<link rel="icon" href="/favicon-32x32.png" sizes="32x32"/>
<link rel="apple-touch-icon" href="/apple-touch-icon.png"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;600;700;800&family=Manrope:wght@400;500;600&display=swap" rel="stylesheet"/>
{GAYA}
{ld_html}
</head>
<body>
<!-- DIBUAT OTOMATIS oleh scripts/halaman.py dari harga.json — jangan disunting tangan. -->
<div class="bungkus">
  <div class="atas">
    <a class="logo" href="/"><img src="/img/logo.png" alt="" width="38" height="38"/><span>RR <em>Hair Care</em></span></a>
    <a class="tombol garis" style="margin:0" href="/#harga">Semua harga</a>
  </div>
  <p class="remah"><a href="/">Beranda</a> › Layanan › {e(h['kicker'])}</p>
  <p class="kicker">{e(h['kicker'])}</p>
  <h1>{e(h['h1'])}</h1>
  <p>{e(h['intro'])}</p>
  <a class="tombol" href="{e(wa_link(h['wa']))}" target="_blank" rel="noopener" data-wa="layanan-{h['slug']}">Booking lewat WhatsApp</a>

  <h2>Harga</h2>
  <table class="harga">
    <tbody>
{tbl}
    </tbody>
  </table>
  <p class="kecil">Harga untuk kondisi rambut normal. Rambut sangat panjang, sangat tebal, atau yang butuh bahan tambahan bisa dikenakan biaya tambahan — selalu disampaikan sebelum pengerjaan dimulai.{(' ' + CATATAN_DURASI) if ada_durasi else ''}</p>

  <h2>Yang perlu kamu tahu</h2>
  <ul>
{poin}
  </ul>

  <h2>Pertanyaan yang sering ditanyakan</h2>
{faq}

  <h2>Lokasi & jam buka</h2>
  <div class="kartu">
{alamat}
      <p>Buka setiap hari 09.00–21.00 WIB · Ada valet parkir di dua salon · Bayar QRIS, transfer, atau tunai.</p>
  </div>
  <a class="tombol" href="{e(wa_link(h['wa']))}" target="_blank" rel="noopener" data-wa="layanan-{h['slug']}-bawah">Chat WhatsApp {WA_TAMPIL}</a>

  <h2>Layanan lain</h2>
  <ul class="lain">
{lain}
      <li><a href="/toko">Belanja produk Inaura</a></li>
  </ul>
</div>
</body>
</html>
"""


def main():
    os.makedirs(KELUAR, exist_ok=True)
    for h in HAL:
        p = os.path.join(KELUAR, h["slug"] + ".html")
        baru = halaman(h)
        if not os.path.exists(p) or open(p).read() != baru:
            open(p, "w").write(baru)
            print("ditulis", os.path.relpath(p, AKAR))
    sisa = {f for f in os.listdir(KELUAR) if f.endswith(".html")} - {h["slug"] + ".html" for h in HAL}
    for f in sisa:
        print("PERINGATAN: halaman tanpa sumber (hapus manual kalau memang dibuang):", f)
    print(f"{len(HAL)} halaman layanan siap")


if __name__ == "__main__":
    main()
