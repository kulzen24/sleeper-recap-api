from ..params import Ctx, parse_week, resolve_league_id
from ..recap_notes import (
    clear_draft,
    get_notes_state,
    publish_draft,
    require_write_token,
    unpublish,
    update_draft,
)
from ..responses import json_response


def _require_write_token(c: Ctx) -> None:
    require_write_token(c.header("authorization"), c.env_var("RECAP_WRITE_TOKEN"))


async def get_published_notes_handler(c: Ctx):
    """Public: the published write-up/superlatives for a week, or null if
    nothing has been published yet. Never exposes the draft."""
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))
    state = await get_notes_state(c.env.RECAP_NOTES, league_id, week)

    return json_response({"week": week, "published": state["published"]})


async def get_draft_notes_handler(c: Ctx):
    """Auth required: the current in-progress draft, so an editor (ChatGPT
    or you) can see what's already there before adding to it."""
    _require_write_token(c)
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))
    state = await get_notes_state(c.env.RECAP_NOTES, league_id, week)

    return json_response({"week": week, "draft": state["draft"]})


async def put_draft_notes_handler(c: Ctx):
    """Auth required: merges the request body into the draft. Omitted fields
    are left as-is, so posting superlatives doesn't erase the write-up (or
    vice versa)."""
    _require_write_token(c)
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))
    body = await c.json_body()

    return json_response(await update_draft(c.env.RECAP_NOTES, league_id, week, body))


async def delete_draft_notes_handler(c: Ctx):
    _require_write_token(c)
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    return json_response(await clear_draft(c.env.RECAP_NOTES, league_id, week))


async def publish_notes_handler(c: Ctx):
    """Auth required: copies the current draft into `published`, making it
    visible on the public recap page and via GET /recap/:week/notes."""
    _require_write_token(c)
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    return json_response(await publish_draft(c.env.RECAP_NOTES, league_id, week))


async def unpublish_notes_handler(c: Ctx):
    """Auth required: hides the page again by clearing `published` (the
    draft is untouched, so you can fix it up and re-publish)."""
    _require_write_token(c)
    league_id = resolve_league_id(c)
    week = parse_week(c.params.get("week"))

    return json_response(await unpublish(c.env.RECAP_NOTES, league_id, week))
