#!/usr/bin/env python3
"""Test untuk ambil_channel() di tambah_src_youtube.py — belum pernah diuji.

Fokus: channel API mengembalikan `items` kosong (mis. token.json login ke
akun Google yang tidak punya channel YouTube). Sebelumnya
`...execute()["items"][0]` diakses langsung di DUA tempat (contentDetails
untuk playlist uploads, brandingSettings untuk deskripsi channel) -> IndexError
mentah. Pola perbaikan disamakan dengan ambil_data_channel.py/ambil_channel()
(lihat PR #95).

Jalankan: python3 -m unittest google/test_tambah_src_youtube.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from tambah_src_youtube import ambil_channel  # noqa: E402


class _FakeExecute:
    def __init__(self, result):
        self._result = result

    def execute(self):
        return self._result


class _FakeChannels:
    def __init__(self, result):
        self._result = result
        self.last_part = None

    def list(self, **kwargs):
        self.last_part = kwargs.get("part")
        return _FakeExecute(self._result)


class _FakeYouTube:
    def __init__(self, channels_result):
        self._channels = _FakeChannels(channels_result)

    def channels(self):
        return self._channels


class TestAmbilChannel(unittest.TestCase):
    def test_items_kosong_berhenti_rapi_bukan_indexerror_mentah(self):
        yt = _FakeYouTube(channels_result={"items": []})
        with self.assertRaises(SystemExit) as ctx:
            ambil_channel(yt, "contentDetails")
        self.assertIn("tidak punya channel YouTube", str(ctx.exception))

    def test_channel_normal_mengembalikan_item_pertama_dengan_part_benar(self):
        ch_data = {"id": "UCxyz", "contentDetails": {"relatedPlaylists": {"uploads": "UUxyz"}}}
        yt = _FakeYouTube(channels_result={"items": [ch_data]})
        self.assertEqual(ambil_channel(yt, "contentDetails"), ch_data)
        self.assertEqual(yt._channels.last_part, "contentDetails")

    def test_part_brandingsettings_diteruskan_ke_api(self):
        ch_data = {"id": "UCxyz", "brandingSettings": {"channel": {"description": "halo"}}}
        yt = _FakeYouTube(channels_result={"items": [ch_data]})
        self.assertEqual(ambil_channel(yt, "brandingSettings"), ch_data)
        self.assertEqual(yt._channels.last_part, "brandingSettings")


if __name__ == "__main__":
    unittest.main()
