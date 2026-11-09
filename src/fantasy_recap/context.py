import asyncio
from dataclasses import dataclass

from .resolvers import ManagerDirectory, build_manager_directory
from .sleeper import get_all_players, get_league, get_league_rosters, get_league_users


@dataclass
class LeagueContext:
    league: dict
    users: list[dict]
    rosters: list[dict]
    players: dict[str, dict]
    managers: ManagerDirectory


async def load_league_context(league_id: str) -> LeagueContext:
    """Loads everything needed to resolve IDs to human-readable names for a
    given league: the league itself, its users/rosters, and the full player
    dictionary. All four requests are cached independently (see sleeper.py)
    and are fetched in parallel here."""
    league, users, rosters, players = await asyncio.gather(
        get_league(league_id),
        get_league_users(league_id),
        get_league_rosters(league_id),
        get_all_players(),
    )

    return LeagueContext(
        league=league,
        users=users,
        rosters=rosters,
        players=players,
        managers=build_manager_directory(users, rosters),
    )
