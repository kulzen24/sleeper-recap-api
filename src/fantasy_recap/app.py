import re
import traceback
from typing import Awaitable, Callable
from urllib.parse import quote, unquote

from .errors import ApiError
from .handlers.draft_detail import draft_detail_handler
from .handlers.drafts import drafts_handler
from .handlers.health import health_handler
from .handlers.league import league_handler
from .handlers.recap import recap_handler
from .handlers.recap_notes import (
    delete_draft_notes_handler,
    get_draft_notes_handler,
    get_published_notes_handler,
    publish_notes_handler,
    put_draft_notes_handler,
    unpublish_notes_handler,
)
from .handlers.recap_page import recap_page_handler
from .handlers.rosters import rosters_handler
from .handlers.standings import standings_handler
from .handlers.taxi_squads import taxi_squads_handler
from .handlers.transactions import transactions_handler
from .handlers.users import users_handler
from .handlers.waiver_wire import waiver_wire_handler
from .handlers.week import week_handler
from .params import Ctx, resolve_league_id
from .responses import json_response, preflight, redirect
from .sleeper import get_nfl_state

Handler = Callable[[Ctx], Awaitable[object]]


async def index_handler(c: Ctx):
    return json_response(
        {
            "name": "fantasy-recap",
            "description": "Read-only JSON API wrapping the public Sleeper fantasy football API for a dynasty league. All IDs are resolved to human-readable names.",
            "default_league_id": c.env_var("DEFAULT_LEAGUE_ID"),
            "note": "Any endpoint below accepts ?league_id=... to target a different public Sleeper league.",
            "endpoints": {
                "GET /health": "Liveness check.",
                "GET /league": "League name, season, status, scoring settings, roster settings.",
                "GET /users": "Managers in the league (user id, display name, team name).",
                "GET /rosters": "Every roster: manager, record, points, starters/bench/taxi/IR with resolved players.",
                "GET /taxi-squads": "Every roster's taxi squad only: manager, squad size, and resolved players.",
                "GET /drafts": "All drafts run in this league.",
                "GET /draft/:draftId": "Every pick in a draft: player, manager, round/pick, auction price if applicable.",
                "GET /week/:week": "All matchups for a week, with starters/bench and per-player scores.",
                "GET /transactions/:week": "Waiver claims, free agent adds/drops, and trades for a week.",
                "GET /standings": "Rosters ranked by win %, then points for.",
                "GET /waiver-wire/:week": "Top unrostered (available) scorers league-wide for a week.",
                "GET /recap/:week": "Everything above for one week, pre-aggregated for an AI weekly recap.",
                "GET /recap-page/:week": "Rendered HTML recap page: published write-up + superlatives + computed stats.",
                "GET /recap/:week/notes": "Published write-up/superlatives for a week (null if not yet published).",
                "GET /recap/:week/notes/draft": "Auth required. The in-progress draft for a week.",
                "PUT /recap/:week/notes/draft": "Auth required. Merge { title?, write_up?, superlatives? } into the draft.",
                "POST /recap/:week/notes/publish": "Auth required. Publish the current draft.",
                "POST /recap/:week/notes/unpublish": "Auth required. Unpublish (hide) the current week's page content.",
            },
        }
    )


async def recap_page_redirect_handler(c: Ctx):
    league_id = resolve_league_id(c)
    try:
        state = await get_nfl_state()
    except Exception:
        state = None
    week = state["week"] if state and (state.get("week") or 0) > 0 else 1
    suffix = f"?league_id={quote(league_id, safe='')}" if c.query("league_id") else ""
    return redirect(f"/recap-page/{week}{suffix}")


def _route(pattern: str) -> re.Pattern:
    """Compiles a Hono-style path like /draft/:draftId into a regex with a
    named group per :param."""
    return re.compile("^" + re.sub(r":(\w+)", r"(?P<\1>[^/]+)", pattern) + "/?$")


ROUTES: list[tuple[str, re.Pattern, Handler]] = [
    ("GET", _route("/"), index_handler),
    ("GET", _route("/health"), health_handler),
    ("GET", _route("/league"), league_handler),
    ("GET", _route("/users"), users_handler),
    ("GET", _route("/rosters"), rosters_handler),
    ("GET", _route("/taxi-squads"), taxi_squads_handler),
    ("GET", _route("/drafts"), drafts_handler),
    ("GET", _route("/draft/:draftId"), draft_detail_handler),
    ("GET", _route("/week/:week"), week_handler),
    ("GET", _route("/transactions/:week"), transactions_handler),
    ("GET", _route("/standings"), standings_handler),
    ("GET", _route("/waiver-wire/:week"), waiver_wire_handler),
    ("GET", _route("/recap/:week"), recap_handler),
    ("GET", _route("/recap/:week/notes"), get_published_notes_handler),
    ("GET", _route("/recap/:week/notes/draft"), get_draft_notes_handler),
    ("PUT", _route("/recap/:week/notes/draft"), put_draft_notes_handler),
    ("DELETE", _route("/recap/:week/notes/draft"), delete_draft_notes_handler),
    ("POST", _route("/recap/:week/notes/publish"), publish_notes_handler),
    ("POST", _route("/recap/:week/notes/unpublish"), unpublish_notes_handler),
    ("GET", _route("/recap-page/:week"), recap_page_handler),
    ("GET", _route("/recap-page"), recap_page_redirect_handler),
]


async def handle_request(request, env):
    c = Ctx(request=request, env=env)
    method = request.method.upper()

    if method == "OPTIONS":
        return preflight()

    try:
        for route_method, pattern, handler in ROUTES:
            # HEAD is answered by the matching GET route, as Hono does.
            if route_method != method and not (method == "HEAD" and route_method == "GET"):
                continue
            match = pattern.match(c.path)
            if match:
                c.params = {key: unquote(value) for key, value in match.groupdict().items()}
                return await handler(c)

        return json_response(
            {"error": "Not Found", "status": 404, "detail": f"No route for {method} {c.path}"},
            404,
        )
    except ApiError as err:
        return json_response({"error": err.message, "status": err.status}, err.status)
    except Exception as err:
        traceback.print_exc()
        return json_response(
            {"error": "Internal Server Error", "status": 500, "detail": str(err)}, 500
        )
