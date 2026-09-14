import type { ManagerDirectory } from "./resolvers";
import { fptsToNumber } from "./resolvers";
import type { ResolvedManager, SleeperRoster } from "./types";

export interface StandingsRow {
  rank: number;
  roster_id: number;
  manager: ResolvedManager;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  points_for: number;
  points_against: number;
}

/** Sleeper doesn't expose a "standings" endpoint directly; this ranks
 * rosters by the conventional fantasy tiebreak order: win percentage,
 * then total points scored. */
export function buildStandings(rosters: SleeperRoster[], managers: ManagerDirectory): StandingsRow[] {
  const rows = rosters.map((roster) => {
    const wins = roster.settings.wins;
    const losses = roster.settings.losses;
    const ties = roster.settings.ties;
    const games = wins + losses + ties;

    return {
      roster_id: roster.roster_id,
      manager: managers.byRosterId.get(roster.roster_id) ?? {
        user_id: roster.owner_id,
        display_name: "Unknown Manager",
        team_name: null,
      },
      wins,
      losses,
      ties,
      win_pct: games > 0 ? Math.round(((wins + ties * 0.5) / games) * 1000) / 1000 : 0,
      points_for: fptsToNumber(roster.settings.fpts, roster.settings.fpts_decimal),
      points_against: fptsToNumber(roster.settings.fpts_against ?? 0, roster.settings.fpts_against_decimal),
    };
  });

  rows.sort((a, b) => b.win_pct - a.win_pct || b.points_for - a.points_for);

  return rows.map((row, index) => ({ rank: index + 1, ...row }));
}
