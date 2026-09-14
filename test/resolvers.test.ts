import { describe, expect, it } from "vitest";
import { buildManagerDirectory, fptsToNumber, resolvePlayer } from "../src/resolvers";
import type { SleeperPlayer, SleeperRoster, SleeperUser } from "../src/types";

const players: Record<string, SleeperPlayer> = {
  "4866": { player_id: "4866", full_name: "Saquon Barkley", position: "RB", team: "PHI" },
  "9999": { player_id: "9999", first_name: "No", last_name: "FullName", position: "WR", team: "NYJ" },
};

describe("resolvePlayer", () => {
  it("resolves a known player by full_name", () => {
    expect(resolvePlayer("4866", players)).toEqual({
      player_id: "4866",
      name: "Saquon Barkley",
      position: "RB",
      team: "PHI",
    });
  });

  it("falls back to first_name + last_name when full_name is missing", () => {
    expect(resolvePlayer("9999", players)).toEqual({
      player_id: "9999",
      name: "No FullName",
      position: "WR",
      team: "NYJ",
    });
  });

  it("resolves a team abbreviation to a defense", () => {
    expect(resolvePlayer("PHI", players)).toEqual({
      player_id: "PHI",
      name: "Philadelphia Eagles Defense",
      position: "DEF",
      team: "PHI",
    });
  });

  it("treats '0' and empty ids as an empty roster slot", () => {
    expect(resolvePlayer("0", players)).toEqual({ player_id: null, name: "Empty", position: null, team: null });
    expect(resolvePlayer(undefined, players)).toEqual({
      player_id: null,
      name: "Empty",
      position: null,
      team: null,
    });
  });

  it("falls back to the raw id for unknown players", () => {
    expect(resolvePlayer("123456", players)).toEqual({
      player_id: "123456",
      name: "123456",
      position: null,
      team: null,
    });
  });
});

describe("buildManagerDirectory", () => {
  const users: SleeperUser[] = [
    { user_id: "u1", display_name: "Alice", is_owner: true, metadata: { team_name: "Alice's Team" } },
    { user_id: "u2", display_name: "Bob", is_owner: null, metadata: null },
  ];
  const rosters: SleeperRoster[] = [
    {
      roster_id: 1,
      owner_id: "u1",
      league_id: "l1",
      players: [],
      starters: [],
      settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
    },
    {
      roster_id: 2,
      owner_id: "u2",
      league_id: "l1",
      players: [],
      starters: [],
      settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
    },
    {
      roster_id: 3,
      owner_id: null,
      league_id: "l1",
      players: [],
      starters: [],
      settings: { wins: 0, losses: 0, ties: 0, fpts: 0 },
    },
  ];

  it("resolves managers by user id and by roster id", () => {
    const { byUserId, byRosterId } = buildManagerDirectory(users, rosters);

    expect(byUserId.get("u1")).toEqual({ user_id: "u1", display_name: "Alice", team_name: "Alice's Team" });
    expect(byRosterId.get(1)).toEqual({ user_id: "u1", display_name: "Alice", team_name: "Alice's Team" });
    expect(byRosterId.get(2)).toEqual({ user_id: "u2", display_name: "Bob", team_name: null });
  });

  it("falls back to an Unknown Manager placeholder for orphaned rosters", () => {
    const { byRosterId } = buildManagerDirectory(users, rosters);
    expect(byRosterId.get(3)).toEqual({ user_id: null, display_name: "Unknown Manager", team_name: null });
  });
});

describe("fptsToNumber", () => {
  it("combines the whole and decimal parts Sleeper reports separately", () => {
    expect(fptsToNumber(1617, 78)).toBe(1617.78);
    expect(fptsToNumber(100, undefined)).toBe(100);
    expect(fptsToNumber(0, 0)).toBe(0);
  });
});
