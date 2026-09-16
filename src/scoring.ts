/** Computes a player's fantasy points for a single week under a specific
 * league's scoring rules, from Sleeper's raw per-category weekly stats
 * (rush_yd, rec_td, pts_allow_0, ...). This is a plain dot product: sum
 * every stat category the league actually scores, times how much it's
 * worth.
 *
 * Verified against this project's league: computing this way for a
 * rostered player/team defense reproduces the exact point value Sleeper
 * reports in /league/:id/matchups/:week's players_points — so it's safe to
 * apply to players nobody rosters, where Sleeper has no points field at
 * all. */
export function computeFantasyPoints(
  rawStats: Record<string, number> | undefined,
  scoringSettings: Record<string, number>,
): number {
  if (!rawStats) return 0;

  let total = 0;
  for (const [category, amount] of Object.entries(rawStats)) {
    const weight = scoringSettings[category];
    if (weight) total += amount * weight;
  }

  return Math.round(total * 100) / 100;
}
