import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { resolveLeagueId } from "../params";
import { resolvePlayer } from "../resolvers";

export async function taxiSquadsHandler(c: Context<{ Bindings: Bindings }>) {
  const { rosters, players, managers } = await loadLeagueContext(resolveLeagueId(c));

  const body = rosters.map((roster) => {
    const taxiSquad = (roster.taxi ?? []).map((id) => resolvePlayer(id, players));

    return {
      roster_id: roster.roster_id,
      manager: managers.byRosterId.get(roster.roster_id) ?? {
        user_id: roster.owner_id,
        display_name: "Unknown Manager",
        team_name: null,
      },
      taxi_squad_size: taxiSquad.length,
      taxi_squad: taxiSquad,
    };
  });

  return c.json(body);
}
