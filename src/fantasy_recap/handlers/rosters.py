from ..context import load_league_context
from ..params import Ctx, resolve_league_id
from ..resolvers import fpts_to_number, resolve_player, unknown_manager
from ..responses import json_response


async def rosters_handler(c: Ctx):
    ctx = await load_league_context(resolve_league_id(c))

    body = []
    for roster in ctx.rosters:
        starter_ids = set(roster.get("starters") or [])
        taxi_ids = set(roster.get("taxi") or [])
        ir_ids = set(roster.get("reserve") or [])

        def slot_for(player_id: str) -> str:
            if player_id in starter_ids:
                return "starter"
            if player_id in ir_ids:
                return "ir"
            if player_id in taxi_ids:
                return "taxi"
            return "bench"

        all_players = [
            {**resolve_player(pid, ctx.players), "roster_slot": slot_for(pid)}
            for pid in roster.get("players") or []
        ]

        def in_slot(slot: str) -> list[dict]:
            return [p for p in all_players if p["roster_slot"] == slot]

        settings = roster["settings"]
        body.append(
            {
                "roster_id": roster["roster_id"],
                "manager": ctx.managers.by_roster_id.get(roster["roster_id"])
                or unknown_manager(roster.get("owner_id")),
                "record": {
                    "wins": settings["wins"],
                    "losses": settings["losses"],
                    "ties": settings["ties"],
                },
                "points_for": fpts_to_number(settings["fpts"], settings.get("fpts_decimal")),
                "points_against": fpts_to_number(
                    settings.get("fpts_against") or 0, settings.get("fpts_against_decimal")
                ),
                # Together these four lists are the roster's full player set;
                # there's no separate flat "all players" array to avoid
                # shipping every player twice in the response.
                "starters": in_slot("starter"),
                "bench": in_slot("bench"),
                "taxi_squad": in_slot("taxi"),
                "injured_reserve": in_slot("ir"),
            }
        )

    return json_response(body)
