#!/usr/bin/env python3
"""Test regresi untuk logika murni papan_skor.py (tanpa kredensial/API).

Pakai stdlib unittest saja — repo ini tak punya dependency test Python lain,
jalankan langsung: python3 laporan/test_papan_skor.py
"""
import unittest

from papan_skor import rasio_silang


class TestRasioSilang(unittest.TestCase):
    def test_kasus_normal_menghasilkan_baris(self):
        baris = rasio_silang(yt_n=40, ig_n=10, follower=2000, subscriber=500)
        self.assertIsNotNone(baris)
        self.assertIn("4.0×", baris)  # yt_n/ig_n = 40/10
        self.assertIn("4.0×", baris.split("padahal")[1])  # follower/subscriber = 2000/500

    def test_subscriber_nol_tidak_crash(self):
        # Channel YouTube baru: sudah dapat trafik pencarian, belum ada subscriber.
        # Sebelum fix ini ZeroDivisionError mentah di i['follower'] / y['subscriber'].
        baris = rasio_silang(yt_n=5, ig_n=10, follower=2000, subscriber=0)
        self.assertIsNone(baris)

    def test_ig_n_nol_tidak_dihitung(self):
        baris = rasio_silang(yt_n=5, ig_n=0, follower=2000, subscriber=500)
        self.assertIsNone(baris)

    def test_yt_n_nol_tidak_dihitung(self):
        baris = rasio_silang(yt_n=0, ig_n=10, follower=2000, subscriber=500)
        self.assertIsNone(baris)


if __name__ == "__main__":
    unittest.main()
