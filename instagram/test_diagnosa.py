#!/usr/bin/env python3
"""Test regresi untuk logika murni diagnosa.py (tanpa kredensial/API).

Pakai stdlib unittest saja -- repo ini tak punya dependency test Python lain,
jalankan langsung: python3 instagram/test_diagnosa.py
"""
import unittest

from diagnosa import rasio_pemenang


class TestRasioPemenang(unittest.TestCase):
    def test_kasus_normal_menghasilkan_baris(self):
        baris = rasio_pemenang(juara_reach=400, lain=[100, 200, 100])
        self.assertIsNotNone(baris)
        self.assertIn("4.0x", baris)  # 400 / median([100,100,200]) = 400/100

    def test_semua_post_lain_reach_nol_tidak_crash(self):
        # Post pembanding yang reach-nya belum terekam API (baru tayang) ->
        # median([0, 0, 0]) == 0. Sebelum fix ini ZeroDivisionError mentah.
        baris = rasio_pemenang(juara_reach=500, lain=[0, 0, 0])
        self.assertIsNone(baris)

    def test_median_nol_karena_campuran_ganjil_tidak_crash(self):
        # Median bisa 0 walau tak semua elemen 0 (mis. [0, 0, 5] -> median 0).
        baris = rasio_pemenang(juara_reach=500, lain=[0, 0, 5])
        self.assertIsNone(baris)


if __name__ == "__main__":
    unittest.main()
