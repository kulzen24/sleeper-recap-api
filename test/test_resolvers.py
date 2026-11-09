import unittest

from fantasy_recap.resolvers import build_manager_directory, fpts_to_number, resolve_player

PLAYERS = {
    "4866": {"player_id": "4866", "full_name": "Saquon Barkley", "position": "RB", "team": "PHI"},
    "9999": {"player_id": "9999", "first_name": "No", "last_name": "FullName", "position": "WR", "team": "NYJ"},
}

EMPTY = {"player_id": None, "name": "Empty", "position": None, "team": None}


def roster(roster_id, owner_id, **settings):
    return {
        "roster_id": roster_id,
        "owner_id": owner_id,
        "league_id": "l1",
        "players": [],
        "starters": [],
        "settings": {"wins": 0, "losses": 0, "ties": 0, "fpts": 0, **settings},
    }


class ResolvePlayerTest(unittest.TestCase):
    def test_resolves_a_known_player_by_full_name(self):
        self.assertEqual(
            resolve_player("4866", PLAYERS),
            {"player_id": "4866", "name": "Saquon Barkley", "position": "RB", "team": "PHI"},
        )

    def test_falls_back_to_first_and_last_name(self):
        self.assertEqual(
            resolve_player("9999", PLAYERS),
            {"player_id": "9999", "name": "No FullName", "position": "WR", "team": "NYJ"},
        )

    def test_resolves_a_team_abbreviation_to_a_defense(self):
        self.assertEqual(
            resolve_player("PHI", PLAYERS),
            {"player_id": "PHI", "name": "Philadelphia Eagles Defense", "position": "DEF", "team": "PHI"},
        )

    def test_treats_zero_and_empty_ids_as_an_empty_roster_slot(self):
        self.assertEqual(resolve_player("0", PLAYERS), EMPTY)
        self.assertEqual(resolve_player(None, PLAYERS), EMPTY)

    def test_falls_back_to_the_raw_id_for_unknown_players(self):
        self.assertEqual(
            resolve_player("123456", PLAYERS),
            {"player_id": "123456", "name": "123456", "position": None, "team": None},
        )


class BuildManagerDirectoryTest(unittest.TestCase):
    users = [
        {"user_id": "u1", "display_name": "Alice", "is_owner": True, "metadata": {"team_name": "Alice's Team"}},
        {"user_id": "u2", "display_name": "Bob", "is_owner": None, "metadata": None},
    ]
    rosters = [roster(1, "u1"), roster(2, "u2"), roster(3, None)]

    def test_resolves_managers_by_user_id_and_by_roster_id(self):
        directory = build_manager_directory(self.users, self.rosters)
        alice = {"user_id": "u1", "display_name": "Alice", "team_name": "Alice's Team"}

        self.assertEqual(directory.by_user_id["u1"], alice)
        self.assertEqual(directory.by_roster_id[1], alice)
        self.assertEqual(directory.by_roster_id[2], {"user_id": "u2", "display_name": "Bob", "team_name": None})

    def test_falls_back_to_unknown_manager_for_orphaned_rosters(self):
        directory = build_manager_directory(self.users, self.rosters)
        self.assertEqual(
            directory.by_roster_id[3], {"user_id": None, "display_name": "Unknown Manager", "team_name": None}
        )


class FptsToNumberTest(unittest.TestCase):
    def test_combines_the_whole_and_decimal_parts(self):
        self.assertEqual(fpts_to_number(1617, 78), 1617.78)
        self.assertEqual(fpts_to_number(100, None), 100)
        self.assertEqual(fpts_to_number(0, 0), 0)
