import json
import time
from typing import Any, Callable

from js import Object, caches
from js import Response as JsResponse
from pyodide.ffi import to_js
from workers import fetch

from .errors import ApiError

SLEEPER_BASE = "https://api.sleeper.app/v1"


class TTL:
    """Cache lifetimes, in seconds. Player metadata is cached far more
    aggressively than everything else since Sleeper's player dataset is
    large (~14MB) and only changes a few times a day."""

    PLAYERS = 60 * 60 * 24
    NFL_STATE = 60 * 5
    LEAGUE = 60
    USERS = 60
    ROSTERS = 30
    MATCHUPS = 30
    DRAFTS = 60 * 5
    DRAFT_PICKS = 60 * 5
    TRANSACTIONS = 30
    PLAYER_STATS = 30


# Per-isolate memory cache. Cloudflare Workers isolates are frequently
# reused across requests, so this often avoids even the Cache API lookup
# for hot data like the player dictionary.
_memory_cache: dict[str, tuple[float, Any]] = {}


async def _cached_fetch(
    path: str,
    ttl_seconds: int,
    object_hook: Callable[[dict], Any] | None = None,
    cache_variant: str | None = None,
) -> Any:
    """`object_hook` is passed to json.loads to slim a payload while parsing
    it. When given, the slimmed JSON (not Sleeper's raw body) is what gets
    stored in the edge cache, under a key distinguished by `cache_variant`,
    so a cold isolate never has to re-parse the full upstream payload."""
    url = f"{SLEEPER_BASE}{path}"
    cache_key = f"{url}?variant={cache_variant}" if cache_variant else url

    cached = _memory_cache.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]

    edge_cache = caches.default
    hit = await edge_cache.match(cache_key)

    if hit:
        text = await hit.text()
        from_edge = True
    else:
        try:
            upstream = await fetch(url, headers={"accept": "application/json"})
        except Exception as err:
            raise ApiError(f"Could not reach the Sleeper API: {err}", 502) from err

        if not 200 <= upstream.status < 300:
            raise ApiError(
                f"Sleeper API request to {path} failed with status {upstream.status}",
                404 if upstream.status == 404 else 502,
            )
        text = await upstream.text()
        from_edge = False

    try:
        value = json.loads(text, object_hook=object_hook)
    except ValueError as err:
        raise ApiError(f"Sleeper API returned invalid JSON for {path}", 502) from err

    if not from_edge:
        body = json.dumps(value, separators=(",", ":")) if object_hook else text
        response = JsResponse.new(
            body,
            to_js(
                {
                    "headers": {
                        "Content-Type": "application/json",
                        "Cache-Control": f"public, max-age={ttl_seconds}",
                    }
                },
                dict_converter=Object.fromEntries,
            ),
        )
        await edge_cache.put(cache_key, response)

    _memory_cache[cache_key] = (time.time() + ttl_seconds, value)
    return value


async def get_league(league_id: str) -> dict:
    return await _cached_fetch(f"/league/{league_id}", TTL.LEAGUE)


async def get_league_users(league_id: str) -> list[dict]:
    return await _cached_fetch(f"/league/{league_id}/users", TTL.USERS)


async def get_league_rosters(league_id: str) -> list[dict]:
    return await _cached_fetch(f"/league/{league_id}/rosters", TTL.ROSTERS)


async def get_matchups(league_id: str, week: int) -> list[dict]:
    return await _cached_fetch(f"/league/{league_id}/matchups/{week}", TTL.MATCHUPS)


async def get_league_drafts(league_id: str) -> list[dict]:
    return await _cached_fetch(f"/league/{league_id}/drafts", TTL.DRAFTS)


async def get_draft(draft_id: str) -> dict:
    return await _cached_fetch(f"/draft/{draft_id}", TTL.DRAFTS)


async def get_draft_picks(draft_id: str) -> list[dict]:
    return await _cached_fetch(f"/draft/{draft_id}/picks", TTL.DRAFT_PICKS)


async def get_transactions(league_id: str, week: int) -> list[dict]:
    return await _cached_fetch(f"/league/{league_id}/transactions/{week}", TTL.TRANSACTIONS)


async def get_nfl_state() -> dict:
    return await _cached_fetch("/state/nfl", TTL.NFL_STATE)


# The only player fields resolvers.resolve_player reads. Everything else in
# Sleeper's player records (injury notes, college, height, a dozen
# third-party ids, ...) is dropped while parsing.
_PLAYER_FIELDS = ("player_id", "full_name", "first_name", "last_name", "position", "team", "fantasy_positions")


def _slim_player(obj: dict) -> dict:
    if "player_id" not in obj:
        return obj
    return {field: obj[field] for field in _PLAYER_FIELDS if field in obj}


async def get_all_players() -> dict[str, dict]:
    """The full Sleeper player dictionary, keyed by player_id. ~14MB and
    updates only a few times a day, hence the aggressive TTL above. Slimmed
    to just the fields this project reads, since a full parse of every
    player record is expensive in Python's memory footprint."""
    return await _cached_fetch("/players/nfl", TTL.PLAYERS, object_hook=_slim_player, cache_variant="slim")


async def get_weekly_stats(season: str, week: int) -> dict[str, dict[str, float]]:
    """Raw per-player weekly stat categories (rush_yd, rec_td, pts_allow_0,
    etc.), keyed by player_id/team-defense-abbreviation, for every player who
    played that week — regardless of whether anyone rosters them in any
    league. NOT part of Sleeper's documented API (https://docs.sleeper.com/
    has no stats endpoint), so treat it as best-effort: it's the only way to
    get fantasy output for a free agent, but Sleeper could change or remove
    it without notice. Combine with a league's scoring_settings via
    compute_fantasy_points() in scoring.py to get that league's actual
    point value — the raw categories are scoring-system-agnostic."""
    return await _cached_fetch(f"/stats/nfl/regular/{season}/{week}", TTL.PLAYER_STATS)
