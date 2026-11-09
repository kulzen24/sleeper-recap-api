import unittest

from fantasy_recap.scoring import compute_fantasy_points

# This league's real scoring_settings (non-zero subset), captured from
# GET /league for the league this project was built against.
SCORING_SETTINGS = {
    "rec": 0.5,
    "rush_yd": 0.1,
    "rec_yd": 0.1,
    "rush_td": 6,
    "rec_td": 6,
    "fum_lost": -2,
    "sack": 1,
    "int": 2,
    "fum_rec": 2,
    "pts_allow_28_34": -1,
}


class ComputeFantasyPointsTest(unittest.TestCase):
    def test_matches_sleepers_reported_points_for_a_real_rostered_player(self):
        # Jonathan Taylor, week 1 2026 for this league: Sleeper's own
        # players_points reported 23.6 for this exact stat line.
        raw_stats = {
            "rush_yd": 98,
            "rush_td": 2,
            "rec": 3,
            "rec_yd": 23,
            "fum_lost": 1,
            "gp": 1,  # categories the league doesn't score should be ignored
            "pos_rank_ppr": 8,
        }
        self.assertEqual(compute_fantasy_points(raw_stats, SCORING_SETTINGS), 23.6)

    def test_matches_sleepers_reported_points_for_a_team_defense(self):
        # Detroit Lions defense, week 1 2026 for this league: Sleeper reported 10.
        raw_stats = {
            "sack": 5,
            "int": 2,
            "fum_rec": 1,
            "pts_allow_28_34": 1,
            "yds_allow": 469,  # not a scored category in this league
        }
        self.assertEqual(compute_fantasy_points(raw_stats, SCORING_SETTINGS), 10)

    def test_returns_0_for_a_player_with_no_recorded_stats(self):
        self.assertEqual(compute_fantasy_points(None, SCORING_SETTINGS), 0)

    def test_ignores_stat_categories_the_league_scoring_does_not_mention(self):
        self.assertEqual(compute_fantasy_points({"made_up_stat": 1000}, SCORING_SETTINGS), 0)
