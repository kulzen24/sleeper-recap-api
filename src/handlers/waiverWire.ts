import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { parseWeek, resolveLeagueId } from "../params";
import { resolvePlayer } from "../resolvers";
import { computeFantasyPoints } from "../scoring";
import { getWeeklyStats } from "../sleeper";

const TOP_N = 25;

export async function waiverWireHandler(c: Context<{ Bindings: Bindings }>) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const { league, rosters, players } = await loadLeagueContext(leagueId);
  const rosteredIds = new Set(rosters.flatMap((roster) => roster.players ?? []));

  const stats = await getWeeklyStats(league.season, week);

  const topAvailable = Object.entries(stats)
    // Sleeper's stats payload includes synthetic "TEAM_XXX" keys (a team's
    // whole-offense totals, not a real player or defense) alongside real
    // player_ids and defense abbreviations like "DET" — drop those.
    .filter(([playerId]) => !playerId.startsWith("TEAM_"))
    .filter(([playerId]) => !rosteredIds.has(playerId))
    .map(([playerId, rawStats]) => ({
      player: resolvePlayer(playerId, players),
      points: computeFantasyPoints(rawStats, league.scoring_settings),
    }))
    .filter((entry) => entry.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_N);

  return c.json({ week, note: `Top ${TOP_N} highest-scoring players not rostered by any team in this league.`, available_players: topAvailable });
}
