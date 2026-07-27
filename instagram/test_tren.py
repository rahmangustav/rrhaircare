#!/usr/bin/env python3
"""Test untuk med() di tren.py — belum pernah diuji sebelumnya.

BUG YANG DIPERBAIKI: med() memfilter baris dengan `if r.get(kunci)` (cek
truthy), yang ikut membuang nilai 0 — bukan cuma None/tak ada. Untuk metrik
`skip` (persentase penonton yang kabur di 3 detik pertama Reel), 0.0% adalah
hook TERBAIK yang mungkin, bukan data kosong. Efeknya: Reel dengan hook
sempurna hilang dari perhitungan median di per_minggu()/dua_periode(), dan
kalau semua Reel matang dalam satu pekan kebetulan skip=0.0%, med()
mengembalikan None sehingga tampilannya jadi "—" (seolah tak ada data sama
sekali) padahal datanya ada dan bagus. Ini kelas bug yang sama dengan
skip=0 terbuang di diagnosa.py, hanya di file berbeda.

Jalankan: python3 -m unittest instagram/test_tren.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tren import med  # noqa: E402


class TestMed(unittest.TestCase):
    def test_daftar_kosong_mengembalikan_none(self):
        self.assertIsNone(med([], "reach"))

    def test_median_ganjil(self):
        rows = [{"reach": 10}, {"reach": 30}, {"reach": 20}]
        self.assertEqual(med(rows, "reach"), 20)

    def test_median_genap_dirata_rata(self):
        rows = [{"reach": 10}, {"reach": 20}, {"reach": 30}, {"reach": 40}]
        self.assertEqual(med(rows, "reach"), 25)

    def test_none_dikecualikan_tapi_nol_tidak(self):
        # Hanya None yang berarti "data tak ada". 0 itu nilai sah (skip rate
        # 0.0% = tak ada yang kabur sama sekali) dan HARUS ikut dihitung.
        rows = [{"skip": 0.0}, {"skip": None}, {"skip": 4.0}]
        self.assertEqual(med(rows, "skip"), 2.0)

    def test_semua_baris_skip_nol_median_nol_bukan_none(self):
        # Sebelum perbaikan: med() mengembalikan None di sini (semua baris
        # falsy dibuang), jadi laporan mingguan menampilkan "—" padahal
        # hook-nya sempurna di seluruh post pekan itu.
        rows = [{"skip": 0.0}, {"skip": 0.0}, {"skip": 0.0}]
        self.assertEqual(med(rows, "skip"), 0.0)

    def test_kunci_tak_ada_di_semua_baris(self):
        rows = [{"reach": 10}, {"reach": 20}]
        self.assertIsNone(med(rows, "skip"))


if __name__ == "__main__":
    unittest.main()
