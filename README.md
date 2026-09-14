# fantasy-recap

A small, read-only JSON API that wraps the public [Sleeper](https://docs.sleeper.com/)
fantasy football API for a dynasty league, and returns clean, human-readable
JSON that's easy for another AI assistant (or a human) to consume to write
draft recaps, weekly recaps, standings analysis, and transaction summaries.

No database, no auth, no build step beyond TypeScript → a single Cloudflare
Worker. Every Sleeper ID (player, roster, user) is resolved to a name before
it's returned — you should never need to look up a `player_id` or `roster_id`
yourself.

## Why Cloudflare Workers

Sleeper's API is public and read-only, so there's nothing to protect and
nothing to persist. Workers gives free, globally-distributed hosting with a
built-in edge Cache API, which is exactly what's needed to avoid hammering
Sleeper's `/players/nfl` endpoint (a ~14MB payload that changes only a few
times a day). No KV, D1, or other bindings are required.

## Endpoints

All endpoints default to the league this project was built for
(`<your-league-id>`) but accept `?league_id=...` to point at any other
public Sleeper league.

| Endpoint | Description |
| --- | --- |
| `GET /health` | Liveness check. |
| `GET /league` | League name, season, status, scoring settings, roster settings. |
| `GET /users` | Managers in the league (user id, display name, team name). |
| `GET /rosters` | Every roster: manager, record, points, starters/bench/taxi/IR with resolved players. |
| `GET /drafts` | All drafts ever run in this league. |
| `GET /draft/:draftId` | Every pick in a draft: player, manager, round/pick, auction price if applicable. |
| `GET /week/:week` | All matchups for a week, with starters/bench and per-player scores. |
| `GET /transactions/:week` | Waiver claims, free agent adds/drops, and trades for a week. |
| `GET /standings` | Rosters ranked by win %, then points for. |
| `GET /recap/:week` | Everything above for one week, pre-aggregated for an AI weekly recap (see below). |

### `/recap/:week`

The one endpoint built specifically for "write me this week's recap." In
addition to the full matchup data, it computes:

- `summary.highest_scoring_team` / `lowest_scoring_team`
- `summary.closest_matchup` / `largest_margin`
- `summary.top_starter_performances` (top 5 starters league-wide, by points)
- `summary.highest_bench_scores` (top 5 bench players league-wide — the
  "should've started them" list)
- `transactions` for that week
- `standings` as of now

### Errors

Failures return a JSON body and a real status code:

```json
{ "error": "\"abc\" is not a valid week number (expected an integer between 1 and 25).", "status": 400 }
```

- `400` — bad input (e.g. a non-numeric week).
- `404` — the league/draft doesn't exist on Sleeper.
- `502` — Sleeper's API is unreachable or returned something unexpected.

## How ID resolution works

Sleeper's API deals almost entirely in opaque IDs (`player_id`, `roster_id`,
`user_id`). This project never hardcodes a player or team name; instead:

- Player names/positions/teams come from Sleeper's `/players/nfl` dictionary
  (`src/sleeper.ts` → `getAllPlayers`), resolved per ID in `src/resolvers.ts`.
- Team defenses (Sleeper represents them as a team abbreviation, e.g. `"PHI"`,
  in starter/bench lists instead of a real player id) are resolved via a
  small built-in NFL team abbreviation → name map, also in `src/resolvers.ts`.
- Managers are resolved by cross-referencing `/league/:id/users` (has
  `display_name` and, if set, a `team_name`) with `/league/:id/rosters` (has
  `owner_id`, which is a `user_id`) — see `buildManagerDirectory`.

## Caching

Every upstream Sleeper request goes through `cachedFetch` in `src/sleeper.ts`,
which layers two caches in front of `fetch`:

1. An in-memory `Map` scoped to the Worker isolate — free, and often hit
   since isolates are commonly reused across requests.
2. The Workers [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/)
   (`caches.default`), which persists at the edge across isolates and
   requests, honoring standard `Cache-Control: max-age` semantics.

TTLs are tuned per endpoint (`src/sleeper.ts` → `TTL`):

| Data | TTL | Why |
| --- | --- | --- |
| `/players/nfl` | 24h | ~14MB, changes only a few times a day. |
| NFL state | 5 min | Rarely relevant but cheap to keep fresh. |
| League / users | 60s | Rarely changes mid-week. |
| Rosters | 30s | Scores update during live games. |
| Matchups | 30s | Same. |
| Drafts / draft picks | 5 min | Static once a draft completes. |
| Transactions | 30s | Waivers/trades can land at any time. |

## Local development

Requires Node 18+ and npm.

```bash
npm install
npm run dev
```

This starts `wrangler dev` on `http://localhost:8787`. Try it against the
default league:

```bash
curl http://localhost:8787/health
curl http://localhost:8787/league
curl http://localhost:8787/rosters
curl http://localhost:8787/recap/1
```

Or against any other public league:

```bash
curl "http://localhost:8787/standings?league_id=<some_other_league_id>"
```

## Tests

```bash
npm test
```

Tests cover the pure resolution/aggregation logic (ID → name resolution,
matchup pairing, standings ranking, transaction resolution) with `vitest`.
They don't hit the network or Sleeper's API.

## Type checking

```bash
npm run typecheck
```

## Deployment (Cloudflare Workers)

1. Install Wrangler if you haven't (it's already a dev dependency, so
   `npx wrangler` works without a separate install).
2. Log in:

   ```bash
   npx wrangler login
   ```

3. Deploy:

   ```bash
   npm run deploy
   ```

   Wrangler will print the deployed URL
   (e.g. `https://fantasy-recap.<your-subdomain>.workers.dev`).

To point the deployed Worker at a different default league, edit
`DEFAULT_LEAGUE_ID` in `wrangler.toml` and redeploy, or just pass
`?league_id=...` per request — no redeploy needed for that.

## Project layout

```
src/
  index.ts          Hono app: routes, CORS, error handling
  sleeper.ts         Sleeper API client + caching
  resolvers.ts        player_id / user_id / roster_id -> name resolution
  context.ts           loads league + users + rosters + players together
  weekMatchups.ts        shared matchup-pairing logic (used by /week and /recap)
  standings.ts             shared standings logic (used by /standings and /recap)
  transactions.ts           shared transaction-resolution logic
  types.ts                   Sleeper API + resolved response types
  errors.ts                   typed ApiError -> HTTP status mapping
  params.ts                    query/path param parsing helpers
  handlers/                     one file per route
test/
  *.test.ts             unit tests for the logic in src/
```
