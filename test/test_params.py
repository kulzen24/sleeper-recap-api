import unittest

from fantasy_recap.errors import ApiError
from fantasy_recap.params import parse_week


class ParseWeekTest(unittest.TestCase):
    def test_accepts_weeks_1_through_25(self):
        self.assertEqual(parse_week("1"), 1)
        self.assertEqual(parse_week("25"), 25)

    def test_rejects_out_of_range_and_non_numeric_weeks(self):
        for raw in ("0", "26", "abc", "1.5", "-1", "1_0", "", None):
            with self.subTest(raw=raw), self.assertRaises(ApiError):
                parse_week(raw)
