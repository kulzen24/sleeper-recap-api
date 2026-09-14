import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./bindings";
import { ApiError } from "./errors";
import { draftDetailHandler } from "./handlers/draftDetail";
import { draftsHandler } from "./handlers/drafts";
import { healthHandler } from "./handlers/health";
import { leagueHandler } from "./handlers/league";
import { recapHandler } from "./handlers/recap";
import { rostersHandler } from "./handlers/rosters";
import { standingsHandler } from "./handlers/standings";
import { transactionsHandler } from "./handlers/transactions";
import { usersHandler } from "./handlers/users";
import { weekHandler } from "./handlers/week";

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

app.get("/", (c) =>
  c.json({
    name: "fantasy-recap",
    description:
      "Read-only JSON API wrapping the public Sleeper fantasy football API for a dynasty league. All IDs are resolved to human-readable names.",
    default_league_id: c.env.DEFAULT_LEAGUE_ID,
    note: "Any endpoint below accepts ?league_id=... to target a different public Sleeper league.",
    endpoints: {
      "GET /health": "Liveness check.",
      "GET /league": "League name, season, status, scoring settings, roster settings.",
      "GET /users": "Managers in the league (user id, display name, team name).",
      "GET /rosters": "Every roster: manager, record, points, starters/bench/taxi/IR with resolved players.",
      "GET /drafts": "All drafts run in this league.",
      "GET /draft/:draftId": "Every pick in a draft: player, manager, round/pick, auction price if applicable.",
      "GET /week/:week": "All matchups for a week, with starters/bench and per-player scores.",
      "GET /transactions/:week": "Waiver claims, free agent adds/drops, and trades for a week.",
      "GET /standings": "Rosters ranked by win %, then points for.",
      "GET /recap/:week": "Everything above for one week, pre-aggregated for an AI weekly recap.",
    },
  }),
);

app.get("/health", healthHandler);
app.get("/league", leagueHandler);
app.get("/users", usersHandler);
app.get("/rosters", rostersHandler);
app.get("/drafts", draftsHandler);
app.get("/draft/:draftId", draftDetailHandler);
app.get("/week/:week", weekHandler);
app.get("/transactions/:week", transactionsHandler);
app.get("/standings", standingsHandler);
app.get("/recap/:week", recapHandler);

app.notFound((c) =>
  c.json({ error: "Not Found", status: 404, detail: `No route for ${c.req.method} ${c.req.path}` }, 404),
);

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.message, status: err.status }, err.status as 400 | 404 | 502);
  }

  console.error(err);
  return c.json({ error: "Internal Server Error", status: 500, detail: err.message }, 500);
});

export default app;
