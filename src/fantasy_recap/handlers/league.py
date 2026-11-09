from ..params import Ctx, resolve_league_id
from ..responses import json_response
from ..sleeper import get_league


async def league_handler(c: Ctx):
    league = await get_league(resolve_league_id(c))

    # Sleeper's scoring_settings includes ~150 keys covering every scoring
    # category it supports (including IDP/kicker-distance categories most
    # leagues don't use), nearly all sitting at 0. Only the non-zero entries
    # actually affect this league, so that's all a consumer needs to see.
    active_scoring = {key: value for key, value in league["scoring_settings"].items() if value != 0}

    return json_response(
        {
            "league_id": league["league_id"],
            "name": league["name"],
            "season": league["season"],
            "season_type": league["season_type"],
            "status": league["status"],
            "sport": league["sport"],
            "total_rosters": league["total_rosters"],
            "roster_positions": league["roster_positions"],
            "scoring_settings": active_scoring,
            "league_settings": league["settings"],
        }
    )
