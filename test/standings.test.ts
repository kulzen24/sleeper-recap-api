import { describe, expect, it } from "vitest";
import { buildManagerDirectory } from "../src/resolvers";
import { buildStandings } from "../src/standings";
import type { SleeperRoster, SleeperUser } from "../src/types";

const users: SleeperUser[] = [
  { user_id: "u1", display_name: "Alice", is_owner: null, metadata: null },
  { user_id: "u2", display_name: "Bob", is_owner: null, metadata: null },
  { user_id: "u3", display_name: "Cara", is_owner: null, metadata: null },
];

describe("buildStandings", () => {
  it("ranks by win percentage, then by points for as a tiebreak", () => {
    const rosters: SleeperRoster[] = [
      {
        roster_id: 1,
        owner_id: "u1",
        league_id: "l1",
        players: [],
        starters: [],
        settings: { wins: 5, losses: 5, ties: 0, fpts: 900, fpts_decimal: 0 },
      },
      {
        roster_id: 2,
        owner_id: "u2",
        league_id: "l1",
        players: [],
        starters: [],
        settings: { wins: 8, losses: 2, ties: 0, fpts: 800, fpts_decimal: 0 },
      },
      {
        roster_id: 3,
        owner_id: "u3",
        league_id: "l1",
        players: [],
        starters: [],
        settings: { wins: 5, losses: 5, ties: 0, fpts: 950, fpts_decimal: 0 },
      },
    ];

    const managers = buildManagerDirectory(users, rosters);
    const standings = buildStandings(rosters, managers);

    expect(standings.map((s) => s.roster_id)).toEqual([2, 3, 1]);
    expect(standings[0].rank).toBe(1);
    expect(standings[0].win_pct).toBe(0.8);
  });

  it("gives a winless, gameless team a 0 win percentage instead of NaN", () => {
    const rosters: SleeperRoster[] = [
      {
        roster_id: 1,
        owner_id: "u1",
        league_id: "l1",
        players: [],
        starters: [],
        settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
      },
    ];
    const managers = buildManagerDirectory(users, rosters);
    const standings = buildStandings(rosters, managers);

    expect(standings[0].win_pct).toBe(0);
  });
});
