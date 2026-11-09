from ..params import Ctx, parse_week, resolve_league_id
from ..recap_data import build_recap_data
from ..responses import json_response


async def recap_handler(c: Ctx):
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    return json_response(await build_recap_data(league_id, week))
