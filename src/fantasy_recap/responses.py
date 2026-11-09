import json
from typing import Any

from workers import Response

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}


def _response(body: str | None, status: int, headers: dict[str, str]) -> Response:
    return Response(body, status=status, headers={**CORS_HEADERS, **headers})


def json_response(data: Any, status: int = 200) -> Response:
    body = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return _response(body, status, {"Content-Type": "application/json"})


def html_response(html: str, status: int = 200) -> Response:
    return _response(html, status, {"Content-Type": "text/html; charset=UTF-8"})


def redirect(location: str, status: int = 302) -> Response:
    return _response(None, status, {"Location": location})


def preflight() -> Response:
    return _response(None, 204, {})
