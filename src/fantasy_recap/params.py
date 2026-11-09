import json
import re
from dataclasses import dataclass, field
from typing import Any
from urllib.parse import parse_qs, urlsplit

from .errors import ApiError, bad_request


def _str_or_none(value: Any) -> str | None:
    # Missing JS values (null/undefined) surface in Python as jsnull or None.
    return value if isinstance(value, str) else None


@dataclass
class Ctx:
    """Per-request context handed to every handler: the Workers request and
    env, the matched path params, and the parsed query string."""

    request: Any
    env: Any
    params: dict[str, str] = field(default_factory=dict)

    def __post_init__(self):
        parts = urlsplit(self.request.url)
        self.path = parts.path
        self._query = parse_qs(parts.query, keep_blank_values=True)

    def query(self, name: str) -> str | None:
        values = self._query.get(name)
        return values[0] if values else None

    def header(self, name: str) -> str | None:
        return _str_or_none(self.request.headers.get(name))

    def env_var(self, name: str) -> str | None:
        return _str_or_none(getattr(self.env, name, None))

    async def json_body(self) -> Any:
        try:
            return json.loads(await self.request.text())
        except ValueError as err:
            raise ApiError("Request body must be valid JSON.", 400) from err


def resolve_league_id(c: Ctx) -> str:
    """League ID defaults to the league this project was built for, but any
    endpoint can be pointed at another public Sleeper league via
    `?league_id=...`."""
    return c.query("league_id") or c.env_var("DEFAULT_LEAGUE_ID")


def parse_week(raw: str | None) -> int:
    week = int(raw) if raw and re.fullmatch(r"[0-9]+", raw) else None
    if week is None or week < 1 or week > 25:
        bad_request(f'"{raw}" is not a valid week number (expected an integer between 1 and 25).')
    return week
