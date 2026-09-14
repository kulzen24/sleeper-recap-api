import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { resolveLeagueId } from "../params";
import { buildStandings } from "../standings";

export async function standingsHandler(c: Context<{ Bindings: Bindings }>) {
  const { rosters, managers } = await loadLeagueContext(resolveLeagueId(c));

  return c.json(buildStandings(rosters, managers));
}
