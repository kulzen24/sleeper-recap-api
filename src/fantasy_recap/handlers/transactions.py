import asyncio

from ..context import load_league_context
from ..params import Ctx, parse_week, resolve_league_id
from ..responses import json_response
from ..sleeper import get_transactions
from ..transactions import resolve_transaction


async def transactions_handler(c: Ctx):
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    transactions, ctx = await asyncio.gather(
        get_transactions(league_id, week), load_league_context(league_id)
    )

    return json_response(
        {
            "week": week,
            "transactions": [resolve_transaction(t, ctx.players, ctx.managers) for t in transactions],
        }
    )
