import type { Context } from "hono";
import type { Bindings } from "./bindings";
import { ApiError } from "./errors";

export interface Superlative {
  title: string;
  winner: string;
  blurb: string;
}

export interface RecapContent {
  title: string | null;
  write_up: string | null;
  superlatives: Superlative[];
  updated_at: string;
}

export interface RecapNotesState {
  week: number;
  draft: RecapContent;
  published: RecapContent | null;
}

const EMPTY_CONTENT: RecapContent = {
  title: null,
  write_up: null,
  superlatives: [],
  updated_at: new Date(0).toISOString(),
};

function kvKey(leagueId: string, week: number): string {
  return `recap-notes:${leagueId}:${week}`;
}

export async function getNotesState(
  kv: KVNamespace,
  leagueId: string,
  week: number,
): Promise<RecapNotesState> {
  const stored = await kv.get<RecapNotesState>(kvKey(leagueId, week), "json");
  return stored ?? { week, draft: EMPTY_CONTENT, published: null };
}

async function saveNotesState(
  kv: KVNamespace,
  leagueId: string,
  week: number,
  state: RecapNotesState,
): Promise<void> {
  await kv.put(kvKey(leagueId, week), JSON.stringify(state));
}

export interface RecapContentPatch {
  title?: string | null;
  write_up?: string | null;
  superlatives?: Superlative[];
}

function validatePatch(patch: unknown): RecapContentPatch {
  if (typeof patch !== "object" || patch === null) {
    throw new ApiError("Request body must be a JSON object.", 400);
  }
  const body = patch as Record<string, unknown>;
  const result: RecapContentPatch = {};

  if ("title" in body) {
    if (body.title !== null && typeof body.title !== "string") {
      throw new ApiError("`title` must be a string or null.", 400);
    }
    result.title = body.title;
  }

  if ("write_up" in body) {
    if (body.write_up !== null && typeof body.write_up !== "string") {
      throw new ApiError("`write_up` must be a string or null.", 400);
    }
    result.write_up = body.write_up;
  }

  if ("superlatives" in body) {
    if (!Array.isArray(body.superlatives)) {
      throw new ApiError("`superlatives` must be an array.", 400);
    }
    result.superlatives = body.superlatives.map((item, index) => {
      if (typeof item !== "object" || item === null) {
        throw new ApiError(`superlatives[${index}] must be an object.`, 400);
      }
      const { title, winner, blurb } = item as Record<string, unknown>;
      if (typeof title !== "string" || typeof winner !== "string" || typeof blurb !== "string") {
        throw new ApiError(
          `superlatives[${index}] must have string fields "title", "winner", and "blurb".`,
          400,
        );
      }
      return { title, winner, blurb };
    });
  }

  return result;
}

/** Merges a partial update into the current draft (fields omitted from the
 * patch are left untouched), so separate calls — one posting the write-up,
 * another posting superlatives — don't clobber each other. */
export async function updateDraft(
  kv: KVNamespace,
  leagueId: string,
  week: number,
  rawPatch: unknown,
): Promise<RecapNotesState> {
  const patch = validatePatch(rawPatch);
  const state = await getNotesState(kv, leagueId, week);

  const draft: RecapContent = {
    title: patch.title !== undefined ? patch.title : state.draft.title,
    write_up: patch.write_up !== undefined ? patch.write_up : state.draft.write_up,
    superlatives: patch.superlatives ?? state.draft.superlatives,
    updated_at: new Date().toISOString(),
  };

  const next: RecapNotesState = { ...state, draft };
  await saveNotesState(kv, leagueId, week, next);
  return next;
}

export async function clearDraft(
  kv: KVNamespace,
  leagueId: string,
  week: number,
): Promise<RecapNotesState> {
  const state = await getNotesState(kv, leagueId, week);
  const next: RecapNotesState = { ...state, draft: EMPTY_CONTENT };
  await saveNotesState(kv, leagueId, week, next);
  return next;
}

export async function publishDraft(
  kv: KVNamespace,
  leagueId: string,
  week: number,
): Promise<RecapNotesState> {
  const state = await getNotesState(kv, leagueId, week);
  const next: RecapNotesState = {
    ...state,
    published: { ...state.draft, updated_at: new Date().toISOString() },
  };
  await saveNotesState(kv, leagueId, week, next);
  return next;
}

export async function unpublish(
  kv: KVNamespace,
  leagueId: string,
  week: number,
): Promise<RecapNotesState> {
  const state = await getNotesState(kv, leagueId, week);
  const next: RecapNotesState = { ...state, published: null };
  await saveNotesState(kv, leagueId, week, next);
  return next;
}

/** Throws 401 unless the request carries `Authorization: Bearer <token>`
 * matching the RECAP_WRITE_TOKEN secret. Used to gate every write to recap
 * notes (draft edits, publish, unpublish). */
export function requireWriteToken(c: Context<{ Bindings: Bindings }>): void {
  const header = c.req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!c.env.RECAP_WRITE_TOKEN) {
    throw new ApiError("RECAP_WRITE_TOKEN is not configured on the server.", 500);
  }
  if (!token || token !== c.env.RECAP_WRITE_TOKEN) {
    throw new ApiError("Missing or invalid Authorization bearer token.", 401);
  }
}
