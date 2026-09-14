import type { ManagerDirectory } from "./resolvers";
import { resolvePlayer } from "./resolvers";
import type { ResolvedManager, ResolvedPlayer, SleeperMatchup, SleeperPlayer } from "./types";

export interface ScoredPlayer extends ResolvedPlayer {
  points: number;
}

export interface MatchupTeam {
  roster_id: number;
  manager: ResolvedManager;
  team_score: number;
  starters: ScoredPlayer[];
  bench: ScoredPlayer[];
}

export interface MatchupGroup {
  /** Null when Sleeper hasn't paired this roster against an opponent yet
   * (e.g. a bye week in an odd-sized league, or matchups not yet set). */
  matchup_id: number | null;
  teams: MatchupTeam[];
}

const UNKNOWN_MANAGER: ResolvedManager = { user_id: null, display_name: "Unknown Manager", team_name: null };

/** Groups raw Sleeper matchup rows (one row per roster) into head-to-head
 * pairings, and resolves every player into a scored, human-readable
 * object. Shared by the /week and /recap endpoints. */
export function buildMatchupGroups(
  matchups: SleeperMatchup[],
  players: Record<string, SleeperPlayer>,
  managers: ManagerDirectory,
): MatchupGroup[] {
  const groups = new Map<string, MatchupTeam[]>();
  let unpairedCount = 0;

  for (const matchup of matchups) {
    const starterIds = matchup.starters ?? [];
    const starterSet = new Set(starterIds);
    const benchIds = (matchup.players ?? []).filter((id) => !starterSet.has(id));
    const pointsMap = matchup.players_points ?? {};

    const toScored = (id: string): ScoredPlayer => ({
      ...resolvePlayer(id, players),
      points: pointsMap[id] ?? 0,
    });

    const team: MatchupTeam = {
      roster_id: matchup.roster_id,
      manager: managers.byRosterId.get(matchup.roster_id) ?? UNKNOWN_MANAGER,
      team_score: matchup.custom_points ?? matchup.points ?? 0,
      starters: starterIds.map(toScored),
      bench: benchIds.map(toScored),
    };

    const key =
      matchup.matchup_id === null || matchup.matchup_id === undefined
        ? `unpaired-${unpairedCount++}`
        : String(matchup.matchup_id);

    const existing = groups.get(key);
    if (existing) {
      existing.push(team);
    } else {
      groups.set(key, [team]);
    }
  }

  return Array.from(groups.entries())
    .map(([key, teams]) => ({
      matchup_id: key.startsWith("unpaired-") ? null : Number(key),
      teams: teams.sort((a, b) => a.roster_id - b.roster_id),
    }))
    .sort((a, b) => (a.matchup_id ?? Number.MAX_SAFE_INTEGER) - (b.matchup_id ?? Number.MAX_SAFE_INTEGER));
}
