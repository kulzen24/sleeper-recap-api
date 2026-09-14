import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { resolveLeagueId } from "../params";
import { getLeagueDrafts } from "../sleeper";

export async function draftsHandler(c: Context<{ Bindings: Bindings }>) {
  const drafts = await getLeagueDrafts(resolveLeagueId(c));

  return c.json(
    drafts.map((draft) => ({
      draft_id: draft.draft_id,
      season: draft.season,
      type: draft.type,
      status: draft.status,
      rounds: draft.settings?.rounds ?? null,
      start_time: draft.start_time ? new Date(draft.start_time).toISOString() : null,
    })),
  );
}
