#!/usr/bin/env python3
"""Test untuk fungsi murni di tren.py — belum pernah diuji sebelumnya.

Fokus pada med() dan siapkan(): logika inti yang menentukan Reel mana yang
dianggap "matang" (>=24 jam) vs "muda", dan bagaimana median dihitung. Kalau
ini salah, seluruh laporan tren (naik/turun, deteksi hook berulang) ikut salah
tanpa ada yang sadar — persis kelas bug yang sudah dua kali ditemukan di
diagnosa.py (skip=0 terbuang) dan papan_skor.py (ZeroDivisionError).

Jalankan: python3 -m unittest instagram/test_tren.py -v
"""
import os
import sys
import unittest
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tren import med, siapkan, UMUR_MATANG_JAM  # noqa: E402


def _snapshot(dibuat: datetime, media: list) -> dict:
    return {
        "dibuat": dibuat.strftime("%Y-%m-%d %H:%M") + " WIB",
        "media": media,
    }


def _reel(tanggal: datetime, reach=100, skip=10.0, shares=0, judul="judul"):
    return {
        "jenis": "Reel",
        "tanggal": tanggal.strftime("%Y-%m-%d %H:%M"),
        "reach": reach,
        "skip": skip,
        "shares": shares,
        "judul": judul,
    }


class TestMed(unittest.TestCase):
    def test_daftar_kosong_mengembalikan_none(self):
        self.assertIsNone(med([], "reach"))

    def test_median_ganjil(self):
        rows = [{"reach": 10}, {"reach": 30}, {"reach": 20}]
        self.assertEqual(med(rows, "reach"), 20)

    def test_median_genap_dirata_rata(self):
        rows = [{"reach": 10}, {"reach": 20}, {"reach": 30}, {"reach": 40}]
        self.assertEqual(med(rows, "reach"), 25)

    def test_nilai_nol_dan_none_dikecualikan(self):
        # r.get(kunci) falsy (0 atau None) ikut difilter — konsisten dengan
        # perilaku asli med(), bukan bug baru yang diperkenalkan test ini.
        rows = [{"reach": 0}, {"reach": None}, {"reach": 50}]
        self.assertEqual(med(rows, "reach"), 50)

    def test_kunci_tak_ada_di_semua_baris(self):
        rows = [{"reach": 10}, {"reach": 20}]
        self.assertIsNone(med(rows, "skip"))


class TestSiapkan(unittest.TestCase):
    def test_hanya_reel_yang_diambil_foto_dibuang(self):
        now = datetime(2026, 7, 20, 12, 0)
        d = _snapshot(now, [
            _reel(now - timedelta(hours=48)),
            {**_reel(now - timedelta(hours=48)), "jenis": "Foto"},
        ])
        _, reels, _, _ = siapkan(d)
        self.assertEqual(len(reels), 1)
        self.assertEqual(reels[0]["jenis"], "Reel")

    def test_umur_dihitung_dalam_jam(self):
        now = datetime(2026, 7, 20, 12, 0)
        d = _snapshot(now, [_reel(now - timedelta(hours=10))])
        _, reels, _, _ = siapkan(d)
        self.assertAlmostEqual(reels[0]["umur"], 10.0, places=6)

    def test_batas_24_jam_persis_masuk_matang(self):
        now = datetime(2026, 7, 20, 12, 0)
        d = _snapshot(now, [_reel(now - timedelta(hours=UMUR_MATANG_JAM))])
        _, _, matang, muda = siapkan(d)
        self.assertEqual(len(matang), 1)
        self.assertEqual(len(muda), 0)

    def test_di_bawah_24_jam_masuk_muda(self):
        # "tanggal" cuma presisi menit (lihat _reel), jadi selisihnya harus
        # >= 1 menit supaya tidak hilang dibulatkan ke jam yang sama.
        now = datetime(2026, 7, 20, 12, 0)
        d = _snapshot(now, [_reel(now - timedelta(hours=UMUR_MATANG_JAM) + timedelta(minutes=1))])
        _, _, matang, muda = siapkan(d)
        self.assertEqual(len(matang), 0)
        self.assertEqual(len(muda), 1)

    def test_reels_diurutkan_dari_paling_lama(self):
        now = datetime(2026, 7, 20, 12, 0)
        r_baru = _reel(now - timedelta(hours=1), judul="baru")
        r_lama = _reel(now - timedelta(hours=100), judul="lama")
        d = _snapshot(now, [r_baru, r_lama])
        _, reels, _, _ = siapkan(d)
        self.assertEqual([r["judul"] for r in reels], ["lama", "baru"])

    def test_daftar_media_kosong(self):
        now = datetime(2026, 7, 20, 12, 0)
        d = _snapshot(now, [])
        _, reels, matang, muda = siapkan(d)
        self.assertEqual((reels, matang, muda), ([], [], []))


if __name__ == "__main__":
    unittest.main()
