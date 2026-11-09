import math
from datetime import datetime, timezone


def round_to(value: float, places: int = 2) -> float:
    """Rounds half-up like JavaScript's Math.round, rather than Python's
    banker's rounding, so point totals match what Sleeper itself reports."""
    factor = 10**places
    return math.floor(value * factor + 0.5) / factor


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def iso_from_ms(ms: float) -> str:
    """Formats a Sleeper epoch-milliseconds timestamp as an ISO-8601 UTC
    string, e.g. 2023-11-14T22:13:20.000Z."""
    return _iso(datetime.fromtimestamp(ms / 1000, tz=timezone.utc))


def now_iso() -> str:
    return _iso(datetime.now(timezone.utc))


EPOCH_ISO = iso_from_ms(0)
