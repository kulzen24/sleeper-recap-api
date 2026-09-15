import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { ApiError } from "../errors";
import { parseWeek, resolveLeagueId } from "../params";
import {
  clearDraft,
  getNotesState,
  publishDraft,
  requireWriteToken,
  unpublish,
  updateDraft,
} from "../recapNotes";

type Ctx = Context<{ Bindings: Bindings }>;

/** Public: the published write-up/superlatives for a week, or null if
 * nothing has been published yet. Never exposes the draft. */
export async function getPublishedNotesHandler(c: Ctx) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));
  const state = await getNotesState(c.env.RECAP_NOTES, leagueId, week);

  return c.json({ week, published: state.published });
}

/** Auth required: the current in-progress draft, so an editor (ChatGPT or
 * you) can see what's already there before adding to it. */
export async function getDraftNotesHandler(c: Ctx) {
  requireWriteToken(c);
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));
  const state = await getNotesState(c.env.RECAP_NOTES, leagueId, week);

  return c.json({ week, draft: state.draft });
}

/** Auth required: merges the request body into the draft. Omitted fields
 * are left as-is, so posting superlatives doesn't erase the write-up (or
 * vice versa). */
export async function putDraftNotesHandler(c: Ctx) {
  requireWriteToken(c);
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));
  const body = await c.req.json().catch(() => {
    throw new ApiError("Request body must be valid JSON.", 400);
  });

  const state = await updateDraft(c.env.RECAP_NOTES, leagueId, week, body);
  return c.json(state);
}

export async function deleteDraftNotesHandler(c: Ctx) {
  requireWriteToken(c);
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const state = await clearDraft(c.env.RECAP_NOTES, leagueId, week);
  return c.json(state);
}

/** Auth required: copies the current draft into `published`, making it
 * visible on the public recap page and via GET /recap/:week/notes. */
export async function publishNotesHandler(c: Ctx) {
  requireWriteToken(c);
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const state = await publishDraft(c.env.RECAP_NOTES, leagueId, week);
  return c.json(state);
}

/** Auth required: hides the page again by clearing `published` (the draft
 * is untouched, so you can fix it up and re-publish). */
export async function unpublishNotesHandler(c: Ctx) {
  requireWriteToken(c);
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const state = await unpublish(c.env.RECAP_NOTES, leagueId, week);
  return c.json(state);
}
