import type { Context } from "hono";
import type { Bindings } from "./bindings";
import { badRequest } from "./errors";

type Ctx = Context<{ Bindings: Bindings }>;

/** League ID defaults to the league this project was built for, but any
 * endpoint can be pointed at another public Sleeper league via
 * `?league_id=...`. */
export function resolveLeagueId(c: Ctx): string {
  return c.req.query("league_id") || c.env.DEFAULT_LEAGUE_ID;
}

export function parseWeek(raw: string | undefined): number {
  const week = Number(raw);
  if (!raw || !Number.isInteger(week) || week < 1 || week > 25) {
    badRequest(`"${raw}" is not a valid week number (expected an integer between 1 and 25).`);
  }
  return week;
}
