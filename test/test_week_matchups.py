import unittest

from fantasy_recap.resolvers import build_manager_directory
from fantasy_recap.week_matchups import build_matchup_groups

from .test_resolvers import roster

PLAYERS = {
    "p1": {"player_id": "p1", "full_name": "Starter One", "position": "QB", "team": "AAA"},
    "p2": {"player_id": "p2", "full_name": "Bench One", "position": "RB", "team": "BBB"},
    "p3": {"player_id": "p3", "full_name": "Starter Two", "position": "QB", "team": "CCC"},
}
USERS = [
    {"user_id": "u1", "display_name": "Alice", "is_owner": None, "metadata": None},
    {"user_id": "u2", "display_name": "Bob", "is_owner": None, "metadata": None},
]
MANAGERS = build_manager_directory(USERS, [roster(1, "u1"), roster(2, "u2")])


class BuildMatchupGroupsTest(unittest.TestCase):
    def test_pairs_two_rosters_sharing_a_matchup_id_and_splits_starters_from_bench(self):
        matchups = [
            {
                "matchup_id": 5,
                "roster_id": 1,
                "points": 20,
                "custom_points": None,
                "starters": ["p1"],
                "players": ["p1", "p2"],
                "players_points": {"p1": 15.5, "p2": 4.5},
            },
            {
                "matchup_id": 5,
                "roster_id": 2,
                "points": 10,
                "custom_points": None,
                "starters": ["p3"],
                "players": ["p3"],
                "players_points": {"p3": 10},
            },
        ]
        groups = build_matchup_groups(matchups, PLAYERS, MANAGERS)

        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["matchup_id"], 5)
        team_one, team_two = groups[0]["teams"]

        self.assertEqual(team_one["roster_id"], 1)
        self.assertEqual(team_one["manager"]["display_name"], "Alice")
        self.assertEqual(
            team_one["starters"],
            [{"player_id": "p1", "name": "Starter One", "position": "QB", "team": "AAA", "points": 15.5}],
        )
        self.assertEqual(
            team_one["bench"],
            [{"player_id": "p2", "name": "Bench One", "position": "RB", "team": "BBB", "points": 4.5}],
        )
        self.assertEqual(team_two["roster_id"], 2)
        self.assertEqual(team_two["manager"]["display_name"], "Bob")

    def test_treats_a_null_matchup_id_as_its_own_unpaired_group(self):
        matchups = [
            {"matchup_id": None, "roster_id": 1, "points": 20, "custom_points": None, "starters": [], "players": []},
            {"matchup_id": None, "roster_id": 2, "points": 10, "custom_points": None, "starters": [], "players": []},
        ]
        groups = build_matchup_groups(matchups, PLAYERS, MANAGERS)

        self.assertEqual(len(groups), 2)
        self.assertTrue(all(g["matchup_id"] is None and len(g["teams"]) == 1 for g in groups))
