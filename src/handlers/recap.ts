import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { parseWeek, resolveLeagueId } from "../params";
import { buildRecapData } from "../recapData";

export async function recapHandler(c: Context<{ Bindings: Bindings }>) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  return c.json(await buildRecapData(leagueId, week));
}
