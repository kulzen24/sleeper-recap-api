import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { parseWeek, resolveLeagueId } from "../params";
import { getMatchups, getTransactions } from "../sleeper";
import { buildStandings } from "../standings";
import { resolveTransaction } from "../transactions";
import type { ResolvedManager } from "../types";
import { buildMatchupGroups, type MatchupTeam, type ScoredPlayer } from "../weekMatchups";

const TOP_N = 5;

function teamSummary(team: MatchupTeam) {
  return { roster_id: team.roster_id, manager: team.manager, team_score: team.team_score };
}

export async function recapHandler(c: Context<{ Bindings: Bindings }>) {
  const leagueId = resolveLeagueId(c);
  const week = parseWeek(c.req.param("week"));

  const [rawMatchups, rawTransactions, leagueContext] = await Promise.all([
    getMatchups(leagueId, week),
    getTransactions(leagueId, week),
    loadLeagueContext(leagueId),
  ]);

  const { players, managers, rosters } = leagueContext;
  const matchups = buildMatchupGroups(rawMatchups, players, managers);
  const allTeams = matchups.flatMap((group) => group.teams);

  let highestScoringTeam = null;
  let lowestScoringTeam = null;
  if (allTeams.length > 0) {
    highestScoringTeam = teamSummary(
      allTeams.reduce((best, team) => (team.team_score > best.team_score ? team : best)),
    );
    lowestScoringTeam = teamSummary(
      allTeams.reduce((worst, team) => (team.team_score < worst.team_score ? team : worst)),
    );
  }

  const headToHead = matchups
    .filter((group) => group.teams.length === 2)
    .map((group) => ({
      matchup_id: group.matchup_id,
      teams: group.teams.map(teamSummary),
      margin: Math.round(Math.abs(group.teams[0].team_score - group.teams[1].team_score) * 100) / 100,
    }));

  const closestMatchup =
    headToHead.length > 0
      ? headToHead.reduce((closest, current) => (current.margin < closest.margin ? current : closest))
      : null;
  const largestMargin =
    headToHead.length > 0
      ? headToHead.reduce((largest, current) => (current.margin > largest.margin ? current : largest))
      : null;

  const withManager = (player: ScoredPlayer, manager: ResolvedManager) => ({ ...player, manager });

  const topStarterPerformances = allTeams
    .flatMap((team) => team.starters.map((player) => withManager(player, team.manager)))
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_N);

  const highestBenchScores = allTeams
    .flatMap((team) => team.bench.map((player) => withManager(player, team.manager)))
    .sort((a, b) => b.points - a.points)
    .slice(0, TOP_N);

  return c.json({
    week,
    matchups,
    summary: {
      highest_scoring_team: highestScoringTeam,
      lowest_scoring_team: lowestScoringTeam,
      closest_matchup: closestMatchup,
      largest_margin: largestMargin,
      top_starter_performances: topStarterPerformances,
      highest_bench_scores: highestBenchScores,
    },
    transactions: rawTransactions.map((t) => resolveTransaction(t, players, managers)),
    standings: buildStandings(rosters, managers),
  });
}
