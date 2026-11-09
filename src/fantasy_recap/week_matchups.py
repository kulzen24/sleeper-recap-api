import sys
from typing import Any

from .resolvers import ManagerDirectory, resolve_player, unknown_manager


def build_matchup_groups(
    matchups: list[dict], players: dict[str, dict], managers: ManagerDirectory
) -> list[dict[str, Any]]:
    """Groups raw Sleeper matchup rows (one row per roster) into head-to-head
    pairings, and resolves every player into a scored, human-readable
    object. Shared by the /week and /recap endpoints.

    A group's matchup_id is None when Sleeper hasn't paired a roster against
    an opponent yet (e.g. a bye week in an odd-sized league, or matchups not
    yet set); each such roster gets its own group."""
    groups: dict[Any, list[dict[str, Any]]] = {}
    unpaired_count = 0

    for matchup in matchups:
        starter_ids = matchup.get("starters") or []
        starter_set = set(starter_ids)
        bench_ids = [pid for pid in matchup.get("players") or [] if pid not in starter_set]
        points_map = matchup.get("players_points") or {}

        def to_scored(player_id: str) -> dict[str, Any]:
            return {**resolve_player(player_id, players), "points": points_map.get(player_id, 0)}

        team_score = matchup.get("custom_points")
        if team_score is None:
            team_score = matchup.get("points") or 0

        team = {
            "roster_id": matchup["roster_id"],
            "manager": managers.by_roster_id.get(matchup["roster_id"]) or unknown_manager(),
            "team_score": team_score,
            "starters": [to_scored(pid) for pid in starter_ids],
            "bench": [to_scored(pid) for pid in bench_ids],
        }

        matchup_id = matchup.get("matchup_id")
        if matchup_id is None:
            key: Any = ("unpaired", unpaired_count)
            unpaired_count += 1
        else:
            key = matchup_id

        groups.setdefault(key, []).append(team)

    result = [
        {
            "matchup_id": None if isinstance(key, tuple) else key,
            "teams": sorted(teams, key=lambda t: t["roster_id"]),
        }
        for key, teams in groups.items()
    ]
    result.sort(key=lambda g: sys.maxsize if g["matchup_id"] is None else g["matchup_id"])
    return result
