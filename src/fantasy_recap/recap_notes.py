import json
from typing import Any

from .errors import ApiError
from .util import EPOCH_ISO, now_iso

# State shape stored per league/week:
#   { week, draft: RecapContent, published: RecapContent | None }
# where RecapContent is { title, write_up, superlatives: [{title, winner, blurb}], updated_at }.


def _empty_content() -> dict[str, Any]:
    return {"title": None, "write_up": None, "superlatives": [], "updated_at": EPOCH_ISO}


def _kv_key(league_id: str, week: int) -> str:
    return f"recap-notes:{league_id}:{week}"


async def get_notes_state(kv, league_id: str, week: int) -> dict[str, Any]:
    raw = await kv.get(_kv_key(league_id, week))
    # A missing KV key comes back as JS null (pyodide's `jsnull`), not None.
    if not isinstance(raw, str):
        return {"week": week, "draft": _empty_content(), "published": None}
    return json.loads(raw)


async def _save_notes_state(kv, league_id: str, week: int, state: dict[str, Any]) -> None:
    await kv.put(_kv_key(league_id, week), json.dumps(state, separators=(",", ":")))


def _validate_patch(patch: Any) -> dict[str, Any]:
    if not isinstance(patch, dict):
        raise ApiError("Request body must be a JSON object.", 400)
    result: dict[str, Any] = {}

    for field in ("title", "write_up"):
        if field in patch:
            if patch[field] is not None and not isinstance(patch[field], str):
                raise ApiError(f"`{field}` must be a string or null.", 400)
            result[field] = patch[field]

    if "superlatives" in patch:
        if not isinstance(patch["superlatives"], list):
            raise ApiError("`superlatives` must be an array.", 400)
        superlatives = []
        for index, item in enumerate(patch["superlatives"]):
            if not isinstance(item, dict):
                raise ApiError(f"superlatives[{index}] must be an object.", 400)
            title, winner, blurb = item.get("title"), item.get("winner"), item.get("blurb")
            if not all(isinstance(value, str) for value in (title, winner, blurb)):
                raise ApiError(
                    f'superlatives[{index}] must have string fields "title", "winner", and "blurb".',
                    400,
                )
            superlatives.append({"title": title, "winner": winner, "blurb": blurb})
        result["superlatives"] = superlatives

    return result


async def update_draft(kv, league_id: str, week: int, raw_patch: Any) -> dict[str, Any]:
    """Merges a partial update into the current draft (fields omitted from
    the patch are left untouched), so separate calls — one posting the
    write-up, another posting superlatives — don't clobber each other."""
    patch = _validate_patch(raw_patch)
    state = await get_notes_state(kv, league_id, week)
    draft = state["draft"]

    next_state = {
        **state,
        "draft": {
            "title": patch.get("title", draft["title"]),
            "write_up": patch.get("write_up", draft["write_up"]),
            "superlatives": patch.get("superlatives", draft["superlatives"]),
            "updated_at": now_iso(),
        },
    }
    await _save_notes_state(kv, league_id, week, next_state)
    return next_state


async def clear_draft(kv, league_id: str, week: int) -> dict[str, Any]:
    state = await get_notes_state(kv, league_id, week)
    next_state = {**state, "draft": _empty_content()}
    await _save_notes_state(kv, league_id, week, next_state)
    return next_state


async def publish_draft(kv, league_id: str, week: int) -> dict[str, Any]:
    state = await get_notes_state(kv, league_id, week)
    next_state = {**state, "published": {**state["draft"], "updated_at": now_iso()}}
    await _save_notes_state(kv, league_id, week, next_state)
    return next_state


async def unpublish(kv, league_id: str, week: int) -> dict[str, Any]:
    state = await get_notes_state(kv, league_id, week)
    next_state = {**state, "published": None}
    await _save_notes_state(kv, league_id, week, next_state)
    return next_state


def require_write_token(authorization: str | None, configured_token: str | None) -> None:
    """Raises 401 unless the request carries `Authorization: Bearer <token>`
    matching the RECAP_WRITE_TOKEN secret. Used to gate every write to recap
    notes (draft edits, publish, unpublish)."""
    header = authorization or ""
    token = header[len("Bearer ") :] if header.startswith("Bearer ") else None

    if not configured_token:
        raise ApiError("RECAP_WRITE_TOKEN is not configured on the server.", 500)
    if not token or token != configured_token:
        raise ApiError("Missing or invalid Authorization bearer token.", 401)
