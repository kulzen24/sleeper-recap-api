from ..context import load_league_context
from ..params import Ctx, resolve_league_id
from ..responses import json_response
from ..standings import build_standings


async def standings_handler(c: Ctx):
    ctx = await load_league_context(resolve_league_id(c))

    return json_response(build_standings(ctx.rosters, ctx.managers))
