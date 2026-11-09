from dataclasses import dataclass
from typing import Any

from .util import round_to

# NFL team abbreviations Sleeper uses as pseudo "player IDs" for team
# defenses in starters/players/matchup arrays.
NFL_TEAMS: dict[str, str] = {
    "ARI": "Arizona Cardinals",
    "ATL": "Atlanta Falcons",
    "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills",
    "CAR": "Carolina Panthers",
    "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals",
    "CLE": "Cleveland Browns",
    "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos",
    "DET": "Detroit Lions",
    "GB": "Green Bay Packers",
    "HOU": "Houston Texans",
    "IND": "Indianapolis Colts",
    "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs",
    "LAC": "Los Angeles Chargers",
    "LAR": "Los Angeles Rams",
    "LV": "Las Vegas Raiders",
    "MIA": "Miami Dolphins",
    "MIN": "Minnesota Vikings",
    "NE": "New England Patriots",
    "NO": "New Orleans Saints",
    "NYG": "New York Giants",
    "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles",
    "PIT": "Pittsburgh Steelers",
    "SEA": "Seattle Seahawks",
    "SF": "San Francisco 49ers",
    "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders",
}


def unknown_manager(user_id: str | None = None) -> dict[str, Any]:
    return {"user_id": user_id, "display_name": "Unknown Manager", "team_name": None}


def resolve_player(player_id: str | None, players: dict[str, dict]) -> dict[str, Any]:
    """Resolves a Sleeper player_id (which may also be a team defense
    abbreviation like "PHI", or "0" for an empty roster slot) into a clean,
    human-readable player object."""
    if not player_id or player_id == "0":
        return {"player_id": None, "name": "Empty", "position": None, "team": None}

    player = players.get(player_id)
    if player:
        name = player.get("full_name")
        if name is None:
            name = " ".join(
                part for part in (player.get("first_name"), player.get("last_name")) if part
            )
        position = player.get("position")
        if position is None:
            position = (player.get("fantasy_positions") or [None])[0]
        return {
            "player_id": player_id,
            "name": name or player_id,
            "position": position,
            "team": player.get("team"),
        }

    if player_id in NFL_TEAMS:
        return {
            "player_id": player_id,
            "name": f"{NFL_TEAMS[player_id]} Defense",
            "position": "DEF",
            "team": player_id,
        }

    return {"player_id": player_id, "name": player_id, "position": None, "team": None}


@dataclass
class ManagerDirectory:
    by_user_id: dict[str, dict[str, Any]]
    by_roster_id: dict[int, dict[str, Any]]


def build_manager_directory(users: list[dict], rosters: list[dict]) -> ManagerDirectory:
    """Builds lookups from Sleeper users + rosters into clean manager objects,
    keyed both by Sleeper user_id and by roster_id (a roster's owner_id is a
    user_id, so rosters need users to resolve to a name/team)."""
    by_user_id = {
        user["user_id"]: {
            "user_id": user["user_id"],
            "display_name": user["display_name"],
            "team_name": (user.get("metadata") or {}).get("team_name"),
        }
        for user in users
    }

    by_roster_id = {}
    for roster in rosters:
        owner_id = roster.get("owner_id")
        manager = by_user_id.get(owner_id) if owner_id else None
        by_roster_id[roster["roster_id"]] = manager or unknown_manager(owner_id)

    return ManagerDirectory(by_user_id=by_user_id, by_roster_id=by_roster_id)


def fpts_to_number(whole: float, decimal: float | None) -> float:
    return round_to(whole + (decimal or 0) / 100)
