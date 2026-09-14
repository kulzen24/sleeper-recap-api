import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { resolveLeagueId } from "../params";
import { getLeague } from "../sleeper";

export async function leagueHandler(c: Context<{ Bindings: Bindings }>) {
  const league = await getLeague(resolveLeagueId(c));

  // Sleeper's scoring_settings includes ~150 keys covering every scoring
  // category it supports (including IDP/kicker-distance categories most
  // leagues don't use), nearly all sitting at 0. Only the non-zero entries
  // actually affect this league, so that's all a consumer needs to see.
  const activeScoring = Object.fromEntries(
    Object.entries(league.scoring_settings).filter(([, value]) => value !== 0),
  );

  return c.json({
    league_id: league.league_id,
    name: league.name,
    season: league.season,
    season_type: league.season_type,
    status: league.status,
    sport: league.sport,
    total_rosters: league.total_rosters,
    roster_positions: league.roster_positions,
    scoring_settings: activeScoring,
    league_settings: league.settings,
  });
}
