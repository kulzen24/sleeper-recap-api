import { buildManagerDirectory, type ManagerDirectory } from "./resolvers";
import { getAllPlayers, getLeague, getLeagueRosters, getLeagueUsers } from "./sleeper";
import type { SleeperLeague, SleeperPlayer, SleeperRoster, SleeperUser } from "./types";

export interface LeagueContext {
  league: SleeperLeague;
  users: SleeperUser[];
  rosters: SleeperRoster[];
  players: Record<string, SleeperPlayer>;
  managers: ManagerDirectory;
}

/** Loads everything needed to resolve IDs to human-readable names for a
 * given league: the league itself, its users/rosters, and the full player
 * dictionary. All four requests are cached independently (see sleeper.ts)
 * and are fetched in parallel here. */
export async function loadLeagueContext(leagueId: string): Promise<LeagueContext> {
  const [league, users, rosters, players] = await Promise.all([
    getLeague(leagueId),
    getLeagueUsers(leagueId),
    getLeagueRosters(leagueId),
    getAllPlayers(),
  ]);

  return { league, users, rosters, players, managers: buildManagerDirectory(users, rosters) };
}
