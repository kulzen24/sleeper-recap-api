from ..context import load_league_context
from ..params import Ctx, parse_week, resolve_league_id
from ..resolvers import resolve_player
from ..responses import json_response
from ..scoring import compute_fantasy_points
from ..sleeper import get_weekly_stats

TOP_N = 25


def _key_order(item: tuple[str, object]) -> tuple[int, int]:
    # Numeric player_ids first, ascending, then everything else (defense
    # abbreviations) in payload order — the order JavaScript object keys
    # iterate in, which this endpoint used to break point ties by.
    key = item[0]
    return (0, int(key)) if key.isdigit() and str(int(key)) == key else (1, 0)


async def waiver_wire_handler(c: Ctx):
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    ctx = await load_league_context(league_id)
    rostered_ids = {pid for roster in ctx.rosters for pid in roster.get("players") or []}

    stats = await get_weekly_stats(ctx.league["season"], week)

    available = [
        {
            "player": resolve_player(player_id, ctx.players),
            "points": compute_fantasy_points(raw_stats, ctx.league["scoring_settings"]),
        }
        for player_id, raw_stats in sorted(stats.items(), key=_key_order)
        # Sleeper's stats payload includes synthetic "TEAM_XXX" keys (a team's
        # whole-offense totals, not a real player or defense) alongside real
        # player_ids and defense abbreviations like "DET" — drop those.
        if not player_id.startswith("TEAM_") and player_id not in rostered_ids
    ]
    top_available = sorted((e for e in available if e["points"] > 0), key=lambda e: -e["points"])[:TOP_N]

    return json_response(
        {
            "week": week,
            "note": f"Top {TOP_N} highest-scoring players not rostered by any team in this league.",
            "available_players": top_available,
        }
    )
