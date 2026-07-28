"""Unit test untuk parse_insight_values() di lapor_ig.py — stdlib saja,
tanpa dependency jaringan/API supaya bisa jalan tanpa token Instagram."""
import importlib.util
import os
import unittest

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "lapor_ig.py")
_spec = importlib.util.spec_from_file_location("lapor_ig", _PATH)
lapor_ig = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(lapor_ig)


class ParseInsightValuesTest(unittest.TestCase):
    def test_metrik_normal_terparse(self):
        data = [
            {"name": "views", "values": [{"value": 120}]},
            {"name": "reach", "values": [{"value": 88}]},
        ]
        self.assertEqual(lapor_ig.parse_insight_values(data),
                          {"views": 120, "reach": 88})

    def test_values_kosong_dilewati_bukan_indexerror(self):
        # Skenario nyata: insight Reel yang baru diunggah belum siap datanya —
        # Graph API balas metrik dengan "values": [] alih-alih menghilangkannya.
        data = [
            {"name": "views", "values": [{"value": 50}]},
            {"name": "reels_skip_rate", "values": []},
        ]
        self.assertEqual(lapor_ig.parse_insight_values(data), {"views": 50})

    def test_semua_metrik_values_kosong(self):
        data = [{"name": "views", "values": []}, {"name": "reach", "values": []}]
        self.assertEqual(lapor_ig.parse_insight_values(data), {})

    def test_data_kosong(self):
        self.assertEqual(lapor_ig.parse_insight_values([]), {})


if __name__ == "__main__":
    unittest.main()
