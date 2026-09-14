import { ApiError } from "./errors";
import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperPlayer,
  SleeperRoster,
  SleeperTransaction,
  SleeperUser,
} from "./types";

const SLEEPER_BASE = "https://api.sleeper.app/v1";

/** Cache lifetimes, in seconds. Player metadata is cached far more
 * aggressively than everything else since Sleeper's player dataset is
 * large (~14MB) and only changes a few times a day. */
export const TTL = {
  PLAYERS: 60 * 60 * 24,
  NFL_STATE: 60 * 5,
  LEAGUE: 60,
  USERS: 60,
  ROSTERS: 30,
  MATCHUPS: 30,
  DRAFTS: 60 * 5,
  DRAFT_PICKS: 60 * 5,
  TRANSACTIONS: 30,
} as const;

// Per-isolate memory cache. Cloudflare Workers isolates are frequently
// reused across requests, so this often avoids even the Cache API lookup
// for hot data like the player dictionary.
const memoryCache = new Map<string, { expires: number; value: unknown }>();

async function cachedFetch<T>(path: string, ttlSeconds: number): Promise<T> {
  const url = `${SLEEPER_BASE}${path}`;

  const cached = memoryCache.get(url);
  if (cached && cached.expires > Date.now()) {
    return cached.value as T;
  }

  const edgeCache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });

  let response = await edgeCache.match(cacheKey);

  if (!response) {
    let upstream: Response;
    try {
      upstream = await fetch(url, { headers: { accept: "application/json" } });
    } catch (err) {
      throw new ApiError(
        `Could not reach the Sleeper API: ${err instanceof Error ? err.message : String(err)}`,
        502,
      );
    }

    if (!upstream.ok) {
      throw new ApiError(
        `Sleeper API request to ${path} failed with status ${upstream.status}`,
        upstream.status === 404 ? 404 : 502,
      );
    }

    response = new Response(upstream.body, upstream);
    response.headers.set("Cache-Control", `public, max-age=${ttlSeconds}`);
    await edgeCache.put(cacheKey, response.clone());
  }

  let value: T;
  try {
    value = await response.json();
  } catch {
    throw new ApiError(`Sleeper API returned invalid JSON for ${path}`, 502);
  }

  memoryCache.set(url, { expires: Date.now() + ttlSeconds * 1000, value });
  return value;
}

export function getLeague(leagueId: string): Promise<SleeperLeague> {
  return cachedFetch<SleeperLeague>(`/league/${leagueId}`, TTL.LEAGUE);
}

export function getLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
  return cachedFetch<SleeperUser[]>(`/league/${leagueId}/users`, TTL.USERS);
}

export function getLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
  return cachedFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`, TTL.ROSTERS);
}

export function getMatchups(leagueId: string, week: number): Promise<SleeperMatchup[]> {
  return cachedFetch<SleeperMatchup[]>(`/league/${leagueId}/matchups/${week}`, TTL.MATCHUPS);
}

export function getLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return cachedFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`, TTL.DRAFTS);
}

export function getDraft(draftId: string): Promise<SleeperDraft> {
  return cachedFetch<SleeperDraft>(`/draft/${draftId}`, TTL.DRAFTS);
}

export function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return cachedFetch<SleeperDraftPick[]>(`/draft/${draftId}/picks`, TTL.DRAFT_PICKS);
}

export function getTransactions(leagueId: string, week: number): Promise<SleeperTransaction[]> {
  return cachedFetch<SleeperTransaction[]>(
    `/league/${leagueId}/transactions/${week}`,
    TTL.TRANSACTIONS,
  );
}

export function getNflState(): Promise<SleeperNflState> {
  return cachedFetch<SleeperNflState>(`/state/nfl`, TTL.NFL_STATE);
}

/** The full Sleeper player dictionary, keyed by player_id. ~14MB and
 * updates only a few times a day, hence the aggressive TTL above. */
export function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  return cachedFetch<Record<string, SleeperPlayer>>(`/players/nfl`, TTL.PLAYERS);
}
