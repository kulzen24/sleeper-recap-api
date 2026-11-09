from ..params import Ctx
from ..responses import json_response
from ..util import now_iso


async def health_handler(c: Ctx):
    return json_response({"status": "ok", "time": now_iso()})
