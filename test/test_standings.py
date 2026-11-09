import unittest

from fantasy_recap.resolvers import build_manager_directory
from fantasy_recap.standings import build_standings

from .test_resolvers import roster

USERS = [
    {"user_id": "u1", "display_name": "Alice", "is_owner": None, "metadata": None},
    {"user_id": "u2", "display_name": "Bob", "is_owner": None, "metadata": None},
    {"user_id": "u3", "display_name": "Cara", "is_owner": None, "metadata": None},
]


class BuildStandingsTest(unittest.TestCase):
    def test_ranks_by_win_percentage_then_points_for(self):
        rosters = [
            roster(1, "u1", wins=5, losses=5, fpts=900, fpts_decimal=0),
            roster(2, "u2", wins=8, losses=2, fpts=800, fpts_decimal=0),
            roster(3, "u3", wins=5, losses=5, fpts=950, fpts_decimal=0),
        ]
        standings = build_standings(rosters, build_manager_directory(USERS, rosters))

        self.assertEqual([s["roster_id"] for s in standings], [2, 3, 1])
        self.assertEqual(standings[0]["rank"], 1)
        self.assertEqual(standings[0]["win_pct"], 0.8)

    def test_gives_a_gameless_team_a_0_win_percentage(self):
        rosters = [roster(1, "u1")]
        standings = build_standings(rosters, build_manager_directory(USERS, rosters))
        self.assertEqual(standings[0]["win_pct"], 0)
