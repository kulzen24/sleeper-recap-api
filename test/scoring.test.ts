import { describe, expect, it } from "vitest";
import { computeFantasyPoints } from "../src/scoring";

// This league's real scoring_settings (non-zero subset), captured from
// GET /league for league 1367312440022290432.
const scoringSettings = {
  rec: 0.5,
  rush_yd: 0.1,
  rec_yd: 0.1,
  rush_td: 6,
  rec_td: 6,
  fum_lost: -2,
  sack: 1,
  int: 2,
  fum_rec: 2,
  pts_allow_28_34: -1,
};

describe("computeFantasyPoints", () => {
  it("matches Sleeper's actual reported points for a real rostered player", () => {
    // Jonathan Taylor, week 1 2026 for this league: Sleeper's own
    // players_points reported 23.6 for this exact stat line.
    const rawStats = {
      rush_yd: 98,
      rush_td: 2,
      rec: 3,
      rec_yd: 23,
      fum_lost: 1,
      gp: 1, // categories the league doesn't score should be ignored
      pos_rank_ppr: 8,
    };

    expect(computeFantasyPoints(rawStats, scoringSettings)).toBe(23.6);
  });

  it("matches Sleeper's actual reported points for a team defense", () => {
    // Detroit Lions defense, week 1 2026 for this league: Sleeper reported 10.
    const rawStats = {
      sack: 5,
      int: 2,
      fum_rec: 1,
      pts_allow_28_34: 1,
      yds_allow: 469, // not a scored category in this league
    };

    expect(computeFantasyPoints(rawStats, scoringSettings)).toBe(10);
  });

  it("returns 0 for a player with no recorded stats", () => {
    expect(computeFantasyPoints(undefined, scoringSettings)).toBe(0);
  });

  it("ignores stat categories the league scoring doesn't mention", () => {
    expect(computeFantasyPoints({ made_up_stat: 1000 }, scoringSettings)).toBe(0);
  });
});
