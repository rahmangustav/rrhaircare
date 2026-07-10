# Cara Menaikkan Toko ke Internet (Netlify — GRATIS)

Skema: **landing + toko digabung jadi satu** di domain `rrhaircare.id`.
- `rrhaircare.id/` → landing (beranda)
- `rrhaircare.id/toko` → toko online
- `rrhaircare.id/admin.html` → panel admin

Backend pakai Netlify Functions + Netlify Blobs (gratis). Cukup 1 akun Netlify.

## Langkah go-live (dari Terminal Linux)

> Di sesi Claude Code, jalankan tiap baris dengan mengetik `! <perintah>`.

1. Masuk folder:
   ```
   cd ~/rr-haircare-shop
   ```

2. **Login CLI** (browser terbuka → klik Authorize). Akunmu sudah ada, tinggal login:
   ```
   npx netlify login
   ```

3. **Hubungkan folder ini ke site yang sudah punya domain rrhaircare.id**:
   ```
   npx netlify link
   ```
   Pilih site landing yang sekarang online (yang domainnya rrhaircare.id).

4. **PREVIEW dulu** (belum menyentuh yang live — dapat URL uji coba):
   ```
   npx netlify deploy --build
   ```
   Buka URL preview (mis. `https://xxxx--namasite.netlify.app`). Cek:
   - Beranda `/` tampil landing + ada tombol **Belanja**.
   - `/toko` tampil toko.
   - `/admin.html` bisa login (password default `admin123`), tambah produk, dll.

5. Kalau preview sudah oke, **baru jadikan LIVE**:
   ```
   npx netlify deploy --build --prod
   ```
   Setelah ini `rrhaircare.id` menyajikan landing + toko sekaligus. HTTPS otomatis.

6. Langsung ke admin live (`https://rrhaircare.id/admin.html`):
   - Ganti password, upload QRIS, isi WhatsApp & rekening, atur ongkir.
   - Tambahkan produk asli + foto.

## Update ke depan
Setiap ada perubahan, ulangi dari folder ini:
```
npx netlify deploy --build --prod
```
(Landing pun sekarang di-update lewat cara ini, bukan drag-drop lagi.)

## Catatan
- Karena build ini **sudah memuat landing-mu**, deploy tidak menghilangkan landing —
  malah menambah toko + fungsi server ke site yang sama.
- Selalu **preview dulu** (langkah 4) sebelum `--prod`.
- Data (produk, pesanan, foto) tersimpan permanen di **Netlify Blobs** milik site.
- Uji coba di komputer tanpa online: klik ikon **Toko RR Hair Care** (menjalankan `netlify dev`)
  atau `npm run dev` → http://localhost:8888
