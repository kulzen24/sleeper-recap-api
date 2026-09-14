import { describe, expect, it } from "vitest";
import { buildManagerDirectory } from "../src/resolvers";
import { resolveTransaction } from "../src/transactions";
import type { SleeperPlayer, SleeperRoster, SleeperTransaction, SleeperUser } from "../src/types";

const players: Record<string, SleeperPlayer> = {
  p1: { player_id: "p1", full_name: "Add Guy", position: "WR", team: "AAA" },
  p2: { player_id: "p2", full_name: "Drop Guy", position: "RB", team: "BBB" },
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

describe("resolveTransaction", () => {
  it("resolves a waiver claim's adds/drops and bid to readable players and managers", () => {
    const transaction: SleeperTransaction = {
      transaction_id: "t1",
      type: "waiver",
      status: "complete",
      created: 1700000000000,
      leg: 1,
      roster_ids: [1],
      adds: { p1: 1 },
      drops: { p2: 1 },
      draft_picks: [],
      waiver_budget: [],
      settings: { waiver_bid: 12 },
    };

    const result = resolveTransaction(transaction, players, managers);

    expect(result.adds).toEqual([{ player: { player_id: "p1", name: "Add Guy", position: "WR", team: "AAA" }, manager: { user_id: "u1", display_name: "Alice", team_name: null } }]);
    expect(result.drops).toEqual([{ player: { player_id: "p2", name: "Drop Guy", position: "RB", team: "BBB" }, manager: { user_id: "u1", display_name: "Alice", team_name: null } }]);
    expect(result.waiver_bid).toBe(12);
    expect(result.created).toBe(new Date(1700000000000).toISOString());
  });

  it("resolves traded draft picks and FAAB between the two rosters involved", () => {
    const transaction: SleeperTransaction = {
      transaction_id: "t2",
      type: "trade",
      status: "complete",
      created: 1700000000000,
      leg: 1,
      roster_ids: [1, 2],
      adds: null,
      drops: null,
      draft_picks: [{ season: "2027", round: 1, roster_id: 1, previous_owner_id: 1, owner_id: 2 }],
      waiver_budget: [{ sender: 2, receiver: 1, amount: 25 }],
      settings: null,
    };

    const result = resolveTransaction(transaction, players, managers);

    expect(result.draft_picks_traded).toEqual([
      {
        season: "2027",
        round: 1,
        from: { user_id: "u1", display_name: "Alice", team_name: null },
        to: { user_id: "u2", display_name: "Bob", team_name: null },
      },
    ]);
    expect(result.faab_traded).toEqual([
      { from: { user_id: "u2", display_name: "Bob", team_name: null }, to: { user_id: "u1", display_name: "Alice", team_name: null }, amount: 25 },
    ]);
  });
});
