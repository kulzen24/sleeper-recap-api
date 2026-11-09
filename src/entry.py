"""Cloudflare Workers entrypoint. All routing/handling lives in the
fantasy_recap package; this file only adapts the Workers runtime to it."""

from workers import WorkerEntrypoint

from fantasy_recap.app import handle_request


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        return await handle_request(request, self.env)
