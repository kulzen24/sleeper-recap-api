from ..params import Ctx, resolve_league_id
from ..responses import json_response
from ..sleeper import get_league_users


async def users_handler(c: Ctx):
    users = await get_league_users(resolve_league_id(c))

    return json_response(
        [
            {
                "user_id": user["user_id"],
                "display_name": user["display_name"],
                "team_name": (user.get("metadata") or {}).get("team_name"),
                "is_commissioner": user.get("is_owner") is True,
            }
            for user in users
        ]
    )
