#!/usr/bin/env python3
"""Test untuk id_video_terbaru() di rawat_video_baru.py — belum pernah diuji.

Fokus: channel API mengembalikan `items` kosong (mis. token.json login ke
akun Google yang tidak punya channel YouTube). Sebelumnya `ch["items"][0]`
diakses langsung -> IndexError mentah, traceback membingungkan untuk skrip
yang dijalankan manual mingguan. Pola perbaikan disamakan dengan
`cek_akses.py` yang sudah lebih dulu mengecek `items` kosong secara eksplisit.

Jalankan: python3 -m unittest google/test_rawat_video_baru.py -v
"""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rawat_video_baru import id_video_terbaru  # noqa: E402


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


class _FakePlaylistItems:
    def __init__(self, result):
        self._result = result

    def list(self, **kwargs):
        return _FakeExecute(self._result)


class _FakeYouTube:
    def __init__(self, channels_result, playlist_result=None):
        self._channels_result = channels_result
        self._playlist_result = playlist_result

    def channels(self):
        return _FakeChannels(self._channels_result)

    def playlistItems(self):
        return _FakePlaylistItems(self._playlist_result)


class TestIdVideoTerbaru(unittest.TestCase):
    def test_items_kosong_berhenti_rapi_bukan_indexerror_mentah(self):
        yt = _FakeYouTube(channels_result={"items": []})
        with self.assertRaises(SystemExit) as ctx:
            id_video_terbaru(yt)
        self.assertIn("tidak punya channel YouTube", str(ctx.exception))

    def test_channel_normal_mengambil_semua_video_dengan_paginasi(self):
        channels_result = {
            "items": [{"contentDetails": {"relatedPlaylists": {"uploads": "UUxyz"}}}]
        }
        playlist_pages = [
            {
                "items": [{"contentDetails": {"videoId": "vid1"}},
                          {"contentDetails": {"videoId": "vid2"}}],
                "nextPageToken": "PAGE2",
            },
            {
                "items": [{"contentDetails": {"videoId": "vid3"}}],
            },
        ]

        class _PagedYouTube(_FakeYouTube):
            def __init__(self):
                super().__init__(channels_result)
                self._call = 0

            def playlistItems(self):
                page = playlist_pages[self._call]
                self._call += 1
                return _FakePlaylistItems(page)

        ids = id_video_terbaru(_PagedYouTube())
        self.assertEqual(ids, ["vid1", "vid2", "vid3"])


if __name__ == "__main__":
    unittest.main()
