# fantasy-recap

A small, read-only JSON API that wraps the public [Sleeper](https://docs.sleeper.com/)
fantasy football API for a dynasty league, and returns clean, human-readable
JSON that's easy for another AI assistant (or a human) to consume to write
draft recaps, weekly recaps, standings analysis, and transaction summaries.

No real database, no build step beyond TypeScript → a single Cloudflare
Worker. Every Sleeper ID (player, roster, user) is resolved to a name before
it's returned — you should never need to look up a `player_id` or `roster_id`
yourself.

Almost everything here is read-only and needs no auth, since it's just a
clean wrapper around Sleeper's public API. The one exception is the
[recap page](#the-recap-page-drafts--publishing) feature, which lets you (or
ChatGPT, on your behalf) write a weekly recap and superlatives and publish
them to a page on the site — that part needs a small persisted store and a
write token, described below.

## Why Cloudflare Workers

Sleeper's API is public and read-only, so most of this needs nothing to
protect and nothing to persist. Workers gives free, globally-distributed
hosting with a built-in edge Cache API, which is exactly what's needed to
avoid hammering Sleeper's `/players/nfl` endpoint (a ~14MB payload that
changes only a few times a day). The recap page's editorial content (your
write-up, ChatGPT's superlatives) needs to persist somewhere, so that one
feature uses a single [Workers KV](https://developers.cloudflare.com/kv/)
namespace — still free-tier, still no real database.

## Endpoints

All endpoints default to the league this project was built for
(`1367312440022290432`) but accept `?league_id=...` to point at any other
public Sleeper league.

| Endpoint | Description |
| --- | --- |
| `GET /health` | Liveness check. |
| `GET /league` | League name, season, status, scoring settings, roster settings. |
| `GET /users` | Managers in the league (user id, display name, team name). |
| `GET /rosters` | Every roster: manager, record, points, starters/bench/taxi/IR with resolved players. |
| `GET /taxi-squads` | Every roster's taxi squad only — manager, squad size, resolved players. Handy for dynasty-stash awards. |
| `GET /drafts` | All drafts ever run in this league. |
| `GET /draft/:draftId` | Every pick in a draft: player, manager, round/pick, auction price if applicable. |
| `GET /week/:week` | All matchups for a week, with starters/bench and per-player scores. |
| `GET /transactions/:week` | Waiver claims, free agent adds/drops, and trades for a week. |
| `GET /standings` | Rosters ranked by win %, then points for. |
| `GET /waiver-wire/:week` | The top-scoring players nobody in the league rosters that week — the "left on the wire" list. See below. |
| `GET /recap/:week` | Everything above for one week, pre-aggregated for an AI weekly recap (see below). |
| `GET /recap-page/:week` | Rendered HTML recap page: published write-up + superlatives + computed stats, with a week switcher. |
| `GET /recap-page` | Redirects to the current NFL week's page. |
| `GET /recap/:week/notes` | The **published** write-up/superlatives for a week (`null` if nothing's published yet). |
| `GET /recap/:week/notes/draft` 🔒 | The in-progress draft (never public). |
| `PUT /recap/:week/notes/draft` 🔒 | Merge `{ title?, write_up?, superlatives? }` into the draft. |
| `DELETE /recap/:week/notes/draft` 🔒 | Reset the draft back to empty. |
| `POST /recap/:week/notes/publish` 🔒 | Copy the current draft to `published` — this is what makes it appear on the page. |
| `POST /recap/:week/notes/unpublish` 🔒 | Clear `published` (hides the page's editorial content again; the draft is untouched). |

🔒 = requires `Authorization: Bearer <RECAP_WRITE_TOKEN>`.

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

### `/waiver-wire/:week`

Who was sitting unrostered that week and scored anyway — the "you could
have had this for free" list. Combine with `/transactions/:week` (which
already tells you who acquired whom) to fully cover a waiver-wire award:
that endpoint has the who-added-what, this one has what an unrostered
player scored *during* the week they were still available.

⚠️ **Relies on an undocumented Sleeper endpoint**
(`/stats/nfl/regular/<season>/<week>`, raw per-player stat categories) —
it's not in the [official API docs](https://docs.sleeper.com/), which only
expose points for players someone actually rosters (via `players_points` in
`/league/:id/matchups/:week`). There's no supported way to get a free
agent's weekly points otherwise. This could change or disappear without
notice; if it does, this route returns a `502` like any other upstream
failure.

To get an accurate point value for a player nobody rosters, this endpoint
takes Sleeper's raw stat categories for a player-week (`rush_yd`, `rec_td`,
`pts_allow_0`, ...) and applies this league's actual `scoring_settings` to
them (`src/scoring.ts` → `computeFantasyPoints`) — the same arithmetic
Sleeper itself uses for rostered players. Verified to reproduce Sleeper's
own reported point totals exactly, for both a skill player and a team
defense, before shipping (see `test/scoring.test.ts`). Returns the top 25
scorers, filtered to players not on any roster in the league.

### The recap page: drafts & publishing

`/recap-page/:week` is a real HTML page (not JSON) meant to be read by
people. It always shows the automatically computed stats (top scorer,
closest matchup, standings, etc. — the same numbers as `/recap/:week`), and
optionally shows a **published** write-up and superlative cards above them.

The workflow is deliberately a two-stage draft → publish, so nothing you or
ChatGPT writes goes live until you say so:

1. **Write into the draft** — one or more `PUT` calls. Fields you omit are
   left alone, so ChatGPT can post superlatives in one call and you can post
   your own prose in another, in any order, without either overwriting the
   other:

   ```bash
   curl -X PUT "https://<your-worker>.workers.dev/recap/1/notes/draft" \
     -H "Authorization: Bearer $RECAP_WRITE_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Week 1: Chaos in the Trenches",
       "superlatives": [
         { "title": "Best Value Pickup", "winner": "thisisntq", "blurb": "Streamed a $2 waiver RB for 20 points." }
       ]
     }'
   ```

   Give ChatGPT the `PUT .../notes/draft` command (with your token) and the
   output of `GET /recap/:week` — it has everything it needs to write
   superlatives without seeing anything else on your site.

2. **Preview it** — open `https://<your-worker>.workers.dev/recap-page/1?preview=<RECAP_WRITE_TOKEN>`
   in a browser. This renders the current *draft*, with a yellow banner
   marking it unpublished. Nobody else can see this — the query param has to
   match the secret token.

3. **Publish when you're happy**:

   ```bash
   curl -X POST "https://<your-worker>.workers.dev/recap/1/notes/publish" \
     -H "Authorization: Bearer $RECAP_WRITE_TOKEN"
   ```

   Now `/recap-page/1` (no token needed) shows it to anyone. To take it back
   down without losing your draft, `POST /recap/1/notes/unpublish`.

Both `write_up` and superlative `blurb`/`winner`/`title` fields are treated
as plain text (HTML-escaped before rendering) — a blank line starts a new
paragraph in the write-up. There's no markdown parsing, intentionally, to
keep the format predictable.

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

Recap notes (draft/published write-ups) are a separate concern — they live in
Workers KV (`RECAP_NOTES` binding, see below), not in this cache layer, since
they're user-written content rather than upstream Sleeper data.

## Local development

Requires Node 18+ and npm.

```bash
npm install
npm run dev
```

This starts `wrangler dev` on `http://localhost:8787`, using a local
simulated KV store (no Cloudflare account needed to develop). Try it against
the default league:

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

The recap-notes write endpoints need `RECAP_WRITE_TOKEN` set locally. A
`.dev.vars` file (gitignored) is already set up with `RECAP_WRITE_TOKEN=local-dev-token`
for local testing:

```bash
curl -X PUT http://localhost:8787/recap/1/notes/draft \
  -H "Authorization: Bearer local-dev-token" \
  -H "Content-Type: application/json" \
  -d '{"write_up": "Testing locally."}'
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

3. One-time setup for the recap page feature (skip if you don't need it):

   ```bash
   # Create the KV namespace that stores drafts/published recaps, then copy
   # the printed `id` into the [[kv_namespaces]] block in wrangler.toml.
   npx wrangler kv namespace create RECAP_NOTES

   # Set the write token — pick your own secret value.
   npx wrangler secret put RECAP_WRITE_TOKEN
   ```

4. Deploy:

   ```bash
   npm run deploy
   ```

   Wrangler will print the deployed URL
   (e.g. `https://fantasy-recap.<your-subdomain>.workers.dev`).

To point the deployed Worker at a different default league, edit
`DEFAULT_LEAGUE_ID` in `wrangler.toml` and redeploy, or just pass
`?league_id=...` per request — no redeploy needed for that.

To rotate the recap write token, run `npx wrangler secret put RECAP_WRITE_TOKEN`
again with a new value — no redeploy needed, it takes effect immediately.

## Project layout

```
src/
  index.ts          Hono app: routes, CORS, error handling
  sleeper.ts         Sleeper API client + caching
  resolvers.ts        player_id / user_id / roster_id -> name resolution
  context.ts           loads league + users + rosters + players together
  recapData.ts           shared stats computation (used by /recap and /recap-page)
  weekMatchups.ts          shared matchup-pairing logic (used by /week and /recap)
  standings.ts               shared standings logic (used by /standings and /recap)
  transactions.ts             shared transaction-resolution logic
  recapNotes.ts                 KV-backed draft/publish storage for recap pages
  html.ts                         HTML escaping + plain-text-to-paragraphs rendering
  types.ts                         Sleeper API + resolved response types
  errors.ts                         typed ApiError -> HTTP status mapping
  params.ts                          query/path param parsing helpers
  handlers/                           one file per route
test/
  *.test.ts             unit tests for the logic in src/
```
