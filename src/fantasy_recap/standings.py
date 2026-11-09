from typing import Any

from .resolvers import ManagerDirectory, fpts_to_number, unknown_manager
from .util import round_to


def build_standings(rosters: list[dict], managers: ManagerDirectory) -> list[dict[str, Any]]:
    """Sleeper doesn't expose a "standings" endpoint directly; this ranks
    rosters by the conventional fantasy tiebreak order: win percentage,
    then total points scored."""
    rows = []
    for roster in rosters:
        settings = roster["settings"]
        wins, losses, ties = settings["wins"], settings["losses"], settings["ties"]
        games = wins + losses + ties

        rows.append(
            {
                "roster_id": roster["roster_id"],
                "manager": managers.by_roster_id.get(roster["roster_id"])
                or unknown_manager(roster.get("owner_id")),
                "wins": wins,
                "losses": losses,
                "ties": ties,
                "win_pct": round_to((wins + ties * 0.5) / games, 3) if games > 0 else 0,
                "points_for": fpts_to_number(settings["fpts"], settings.get("fpts_decimal")),
                "points_against": fpts_to_number(
                    settings.get("fpts_against") or 0, settings.get("fpts_against_decimal")
                ),
            }
        )

    rows.sort(key=lambda row: (-row["win_pct"], -row["points_for"]))

    return [{"rank": index + 1, **row} for index, row in enumerate(rows)]
