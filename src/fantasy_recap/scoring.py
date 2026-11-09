from .util import round_to


def compute_fantasy_points(
    raw_stats: dict[str, float] | None, scoring_settings: dict[str, float]
) -> float:
    """Computes a player's fantasy points for a single week under a specific
    league's scoring rules, from Sleeper's raw per-category weekly stats
    (rush_yd, rec_td, pts_allow_0, ...). This is a plain dot product: sum
    every stat category the league actually scores, times how much it's
    worth.

    Verified against this project's league: computing this way for a
    rostered player/team defense reproduces the exact point value Sleeper
    reports in /league/:id/matchups/:week's players_points — so it's safe to
    apply to players nobody rosters, where Sleeper has no points field at
    all."""
    if not raw_stats:
        return 0

    total = 0.0
    for category, amount in raw_stats.items():
        weight = scoring_settings.get(category)
        if weight:
            total += amount * weight

    return round_to(total)
