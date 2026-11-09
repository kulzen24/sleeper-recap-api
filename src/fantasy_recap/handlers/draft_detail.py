import asyncio
import math

from ..context import load_league_context
from ..errors import bad_request
from ..params import Ctx
from ..resolvers import resolve_player, unknown_manager
from ..responses import json_response
from ..sleeper import get_draft, get_draft_picks
from ..util import iso_from_ms


def _auction_amount(raw: str | None) -> int | float | None:
    if not raw:
        return None
    try:
        amount = float(raw)
    except ValueError:
        return None
    if not math.isfinite(amount):
        return None
    return int(amount) if amount.is_integer() else amount


async def draft_detail_handler(c: Ctx):
    draft_id = c.params.get("draftId")
    if not draft_id:
        bad_request("Missing draftId in path.")

    draft = await get_draft(draft_id)
    picks, ctx = await asyncio.gather(get_draft_picks(draft_id), load_league_context(draft["league_id"]))

    resolved_picks = []
    for pick in picks:
        manager = (
            ctx.managers.by_user_id.get(pick.get("picked_by"))
            or ctx.managers.by_roster_id.get(int(pick["roster_id"]))
            or unknown_manager(pick.get("picked_by") or None)
        )
        resolved_picks.append(
            {
                "round": pick["round"],
                "pick_no": pick["pick_no"],
                "draft_slot": pick["draft_slot"],
                "roster_id": int(pick["roster_id"]),
                "manager": manager,
                "player": resolve_player(pick.get("player_id"), ctx.players),
                "is_keeper": pick.get("is_keeper") or False,
                "auction_amount": _auction_amount((pick.get("metadata") or {}).get("amount")),
            }
        )
    resolved_picks.sort(key=lambda p: p["pick_no"])

    return json_response(
        {
            "draft_id": draft["draft_id"],
            "league_id": draft["league_id"],
            "season": draft["season"],
            "type": draft["type"],
            "status": draft["status"],
            "rounds": (draft.get("settings") or {}).get("rounds"),
            "start_time": iso_from_ms(draft["start_time"]) if draft.get("start_time") else None,
            "picks": resolved_picks,
        }
    )
