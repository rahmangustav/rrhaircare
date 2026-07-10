# Toko Online RR Hair Care — Panduan

Prototype toko online: customer belanja produk, bayar via **QRIS/transfer (konfirmasi manual)**,
ongkir **tarif tetap** yang bisa kamu atur, dan **admin panel** untuk kelola produk & pesanan sendiri.

## Cara menjalankan di komputer (uji coba)
Klik ikon **Toko RR Hair Care** di launcher ChromeOS, atau:
```bash
cd ~/rr-haircare-shop
npm run dev
```
Lalu buka di browser:
- 🛍️ Toko (untuk customer): http://localhost:8888
- 🔐 Admin (untuk kamu): http://localhost:8888/admin.html

## Cara menaikkan ke internet (online, gratis)
Lihat **DEPLOY.md** — pakai Netlify (gratis), cukup 1 akun.

## Login admin
- Password default: **admin123**
- **WAJIB ganti** lewat menu *Pengaturan → Ganti Password*.

## Yang bisa kamu lakukan di Admin
1. **Produk** — tambah produk baru (nama, kategori, harga, stok, deskripsi, foto),
   edit, hapus, atau sembunyikan dari toko. Stok otomatis berkurang tiap ada pesanan.
2. **Pesanan** — lihat pesanan masuk, cek bukti transfer yang diupload customer,
   ubah status (Perlu Verifikasi → Diproses → Dikirim → Selesai), dan chat pembeli via WhatsApp.
3. **Pengaturan** — nama toko, nomor WhatsApp, info rekening, **upload gambar QRIS**,
   atur zona & tarif ongkir, ganti password.

## Alur belanja customer
Pilih produk → keranjang → isi data kirim → pilih ongkir → buat pesanan →
scan QRIS / transfer → upload bukti bayar → kamu verifikasi di admin.

## Data & backup
Semua data ada di folder `data/` (produk, pesanan, pengaturan) dan `uploads/` (gambar).
Backup = cukup salin dua folder itu.

## Catatan penting (ini masih prototype)
- Pembayaran belum otomatis — kamu verifikasi bukti transfer manual. Sesuai pilihanmu (QRIS statis).
- Belum online di internet; masih jalan di komputer. Untuk go-live di `rrhaircare.id`
  tinggal deploy ke server/hosting (bisa dibantu nanti).
- Kalau nanti mau **otomatis** (pembayaran & cek ongkir real-time), tinggal upgrade ke
  Midtrans + Biteship tanpa bongkar total — strukturnya sudah disiapkan.
