import type {
  ResolvedManager,
  ResolvedPlayer,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
} from "./types";

/** NFL team abbreviations Sleeper uses as pseudo "player IDs" for team
 * defenses in starters/players/matchup arrays. */
const NFL_TEAMS: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

/** Resolves a Sleeper player_id (which may also be a team defense
 * abbreviation like "PHI", or "0" for an empty roster slot) into a clean,
 * human-readable player object. */
export function resolvePlayer(
  playerId: string | null | undefined,
  players: Record<string, SleeperPlayer>,
): ResolvedPlayer {
  if (!playerId || playerId === "0") {
    return { player_id: null, name: "Empty", position: null, team: null };
  }

  const player = players[playerId];
  if (player) {
    const name = player.full_name ?? [player.first_name, player.last_name].filter(Boolean).join(" ");
    return {
      player_id: playerId,
      name: name || playerId,
      position: player.position ?? player.fantasy_positions?.[0] ?? null,
      team: player.team ?? null,
    };
  }

  if (playerId in NFL_TEAMS) {
    return {
      player_id: playerId,
      name: `${NFL_TEAMS[playerId]} Defense`,
      position: "DEF",
      team: playerId,
    };
  }

  return { player_id: playerId, name: playerId, position: null, team: null };
}

export interface ManagerDirectory {
  byUserId: Map<string, ResolvedManager>;
  byRosterId: Map<number, ResolvedManager>;
}

/** Builds lookups from Sleeper users + rosters into clean manager objects,
 * keyed both by Sleeper user_id and by roster_id (a roster's owner_id is a
 * user_id, so rosters need users to resolve to a name/team). */
export function buildManagerDirectory(
  users: SleeperUser[],
  rosters: SleeperRoster[],
): ManagerDirectory {
  const byUserId = new Map<string, ResolvedManager>();
  for (const user of users) {
    byUserId.set(user.user_id, {
      user_id: user.user_id,
      display_name: user.display_name,
      team_name: user.metadata?.team_name ?? null,
    });
  }

  const byRosterId = new Map<number, ResolvedManager>();
  for (const roster of rosters) {
    const manager = roster.owner_id ? byUserId.get(roster.owner_id) : undefined;
    byRosterId.set(
      roster.roster_id,
      manager ?? { user_id: roster.owner_id, display_name: "Unknown Manager", team_name: null },
    );
  }

  return { byUserId, byRosterId };
}

export function fptsToNumber(whole: number, decimal: number | undefined): number {
  return Math.round((whole + (decimal ?? 0) / 100) * 100) / 100;
}
