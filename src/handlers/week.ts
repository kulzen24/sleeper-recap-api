import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { parseWeek, resolveLeagueId } from "../params";
import { getMatchups } from "../sleeper";
import { buildMatchupGroups } from "../weekMatchups";

export async function weekHandler(c: Context<{ Bindings: Bindings }>) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const [matchups, { players, managers }] = await Promise.all([
    getMatchups(leagueId, week),
    loadLeagueContext(leagueId),
  ]);

  return c.json({
    week,
    matchups: buildMatchupGroups(matchups, players, managers),
  });
}
