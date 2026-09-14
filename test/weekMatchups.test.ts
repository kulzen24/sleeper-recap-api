import { describe, expect, it } from "vitest";
import { buildManagerDirectory } from "../src/resolvers";
import type { SleeperMatchup, SleeperPlayer, SleeperRoster, SleeperUser } from "../src/types";
import { buildMatchupGroups } from "../src/weekMatchups";

const players: Record<string, SleeperPlayer> = {
  p1: { player_id: "p1", full_name: "Starter One", position: "QB", team: "AAA" },
  p2: { player_id: "p2", full_name: "Bench One", position: "RB", team: "BBB" },
  p3: { player_id: "p3", full_name: "Starter Two", position: "QB", team: "CCC" },
};

const users: SleeperUser[] = [
  { user_id: "u1", display_name: "Alice", is_owner: null, metadata: null },
  { user_id: "u2", display_name: "Bob", is_owner: null, metadata: null },
];

const rosters: SleeperRoster[] = [
  { roster_id: 1, owner_id: "u1", league_id: "l1", players: [], starters: [], settings: { wins: 0, losses: 0, ties: 0, fpts: 0 } },
  { roster_id: 2, owner_id: "u2", league_id: "l1", players: [], starters: [], settings: { wins: 0, losses: 0, ties: 0, fpts: 0 } },
];

const managers = buildManagerDirectory(users, rosters);

describe("buildMatchupGroups", () => {
  it("pairs two rosters sharing a matchup_id and splits starters from bench", () => {
    const matchups: SleeperMatchup[] = [
      {
        matchup_id: 5,
        roster_id: 1,
        points: 20,
        custom_points: null,
        starters: ["p1"],
        players: ["p1", "p2"],
        players_points: { p1: 15.5, p2: 4.5 },
      },
      {
        matchup_id: 5,
        roster_id: 2,
        points: 10,
        custom_points: null,
        starters: ["p3"],
        players: ["p3"],
        players_points: { p3: 10 },
      },
    ];

    const groups = buildMatchupGroups(matchups, players, managers);

    expect(groups).toHaveLength(1);
    expect(groups[0].matchup_id).toBe(5);
    expect(groups[0].teams).toHaveLength(2);

    const [teamOne, teamTwo] = groups[0].teams;
    expect(teamOne.roster_id).toBe(1);
    expect(teamOne.manager.display_name).toBe("Alice");
    expect(teamOne.starters).toEqual([{ player_id: "p1", name: "Starter One", position: "QB", team: "AAA", points: 15.5 }]);
    expect(teamOne.bench).toEqual([{ player_id: "p2", name: "Bench One", position: "RB", team: "BBB", points: 4.5 }]);

    expect(teamTwo.roster_id).toBe(2);
    expect(teamTwo.manager.display_name).toBe("Bob");
  });

  it("treats a null matchup_id as its own unpaired group", () => {
    const matchups: SleeperMatchup[] = [
      { matchup_id: null, roster_id: 1, points: 20, custom_points: null, starters: [], players: [] },
      { matchup_id: null, roster_id: 2, points: 10, custom_points: null, starters: [], players: [] },
    ];

    const groups = buildMatchupGroups(matchups, players, managers);

    expect(groups).toHaveLength(2);
    expect(groups.every((g) => g.matchup_id === null && g.teams.length === 1)).toBe(true);
  });
});
