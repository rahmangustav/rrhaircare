#!/usr/bin/env python3
"""Test untuk ambil_channel() di ambil_data_channel.py — belum pernah diuji.

Fokus: channel API mengembalikan `items` kosong (mis. token.json login ke
akun Google yang tidak punya channel YouTube). Sebelumnya
`...execute()["items"][0]` diakses langsung -> IndexError mentah. Pola
perbaikan disamakan dengan rawat_video_baru.py/id_video_terbaru() (lihat PR
sebelumnya) dan cek_akses.py yang sudah lebih dulu mengecek `items` kosong.

Jalankan: python3 -m unittest google/test_ambil_data_channel.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ambil_data_channel import ambil_channel  # noqa: E402


class _FakeExecute:
    def __init__(self, result):
        self._result = result

    def execute(self):
        return self._result


class _FakeChannels:
    def __init__(self, result):
        self._result = result

    def list(self, **kwargs):
        return _FakeExecute(self._result)


class _FakeYouTube:
    def __init__(self, channels_result):
        self._channels_result = channels_result

    def channels(self):
        return _FakeChannels(self._channels_result)


class TestAmbilChannel(unittest.TestCase):
    def test_items_kosong_berhenti_rapi_bukan_indexerror_mentah(self):
        yt = _FakeYouTube(channels_result={"items": []})
        with self.assertRaises(SystemExit) as ctx:
            ambil_channel(yt)
        self.assertIn("tidak punya channel YouTube", str(ctx.exception))

    def test_channel_normal_mengembalikan_item_pertama(self):
        ch_data = {"id": "UCxyz", "snippet": {"title": "RR Hair Care"}}
        yt = _FakeYouTube(channels_result={"items": [ch_data]})
        self.assertEqual(ambil_channel(yt), ch_data)


if __name__ == "__main__":
    unittest.main()
