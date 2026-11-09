import asyncio

from ..context import load_league_context
from ..params import Ctx, parse_week, resolve_league_id
from ..responses import json_response
from ..sleeper import get_matchups
from ..week_matchups import build_matchup_groups


async def week_handler(c: Ctx):
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    matchups, ctx = await asyncio.gather(get_matchups(league_id, week), load_league_context(league_id))

    return json_response(
        {"week": week, "matchups": build_matchup_groups(matchups, ctx.players, ctx.managers)}
    )
