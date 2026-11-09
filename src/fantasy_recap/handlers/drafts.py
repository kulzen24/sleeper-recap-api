from ..params import Ctx, resolve_league_id
from ..responses import json_response
from ..sleeper import get_league_drafts
from ..util import iso_from_ms


async def drafts_handler(c: Ctx):
    drafts = await get_league_drafts(resolve_league_id(c))

    return json_response(
        [
            {
                "draft_id": draft["draft_id"],
                "season": draft["season"],
                "type": draft["type"],
                "status": draft["status"],
                "rounds": (draft.get("settings") or {}).get("rounds"),
                "start_time": iso_from_ms(draft["start_time"]) if draft.get("start_time") else None,
            }
            for draft in drafts
        ]
    )
