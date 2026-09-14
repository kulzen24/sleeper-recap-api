import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { resolveLeagueId } from "../params";
import { fptsToNumber, resolvePlayer } from "../resolvers";
import type { ResolvedPlayer } from "../types";

type RosterSlot = "starter" | "bench" | "taxi" | "ir";

interface RosterPlayer extends ResolvedPlayer {
  roster_slot: RosterSlot;
}

export async function rostersHandler(c: Context<{ Bindings: Bindings }>) {
  const { rosters, players, managers } = await loadLeagueContext(resolveLeagueId(c));

  const body = rosters.map((roster) => {
    const starterIds = new Set(roster.starters ?? []);
    const taxiIds = new Set(roster.taxi ?? []);
    const irIds = new Set(roster.reserve ?? []);
    const allIds = roster.players ?? [];

    const slotFor = (id: string): RosterSlot => {
      if (starterIds.has(id)) return "starter";
      if (irIds.has(id)) return "ir";
      if (taxiIds.has(id)) return "taxi";
      return "bench";
    };

    const allPlayers: RosterPlayer[] = allIds.map((id) => ({
      ...resolvePlayer(id, players),
      roster_slot: slotFor(id),
    }));

    return {
      roster_id: roster.roster_id,
      manager: managers.byRosterId.get(roster.roster_id) ?? {
        user_id: roster.owner_id,
        display_name: "Unknown Manager",
        team_name: null,
      },
      record: {
        wins: roster.settings.wins,
        losses: roster.settings.losses,
        ties: roster.settings.ties,
      },
      points_for: fptsToNumber(roster.settings.fpts, roster.settings.fpts_decimal),
      points_against: fptsToNumber(
        roster.settings.fpts_against ?? 0,
        roster.settings.fpts_against_decimal,
      ),
      // Together these four lists are the roster's full player set; there's
      // no separate flat "all players" array to avoid shipping every player
      // twice in the response.
      starters: allPlayers.filter((p) => p.roster_slot === "starter"),
      bench: allPlayers.filter((p) => p.roster_slot === "bench"),
      taxi_squad: allPlayers.filter((p) => p.roster_slot === "taxi"),
      injured_reserve: allPlayers.filter((p) => p.roster_slot === "ir"),
    };
  });

  return c.json(body);
}
