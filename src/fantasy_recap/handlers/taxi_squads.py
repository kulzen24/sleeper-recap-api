from ..context import load_league_context
from ..params import Ctx, resolve_league_id
from ..resolvers import resolve_player, unknown_manager
from ..responses import json_response


async def taxi_squads_handler(c: Ctx):
    ctx = await load_league_context(resolve_league_id(c))

    body = []
    for roster in ctx.rosters:
        taxi_squad = [resolve_player(pid, ctx.players) for pid in roster.get("taxi") or []]
        body.append(
            {
                "roster_id": roster["roster_id"],
                "manager": ctx.managers.by_roster_id.get(roster["roster_id"])
                or unknown_manager(roster.get("owner_id")),
                "taxi_squad_size": len(taxi_squad),
                "taxi_squad": taxi_squad,
            }
        )

    return json_response(body)
