import type { Context } from "hono";
import type { Bindings } from "../bindings";
import { loadLeagueContext } from "../context";
import { badRequest } from "../errors";
import { resolvePlayer } from "../resolvers";
import { getDraft, getDraftPicks } from "../sleeper";

export async function draftDetailHandler(c: Context<{ Bindings: Bindings }>) {
  const draftId = c.req.param("draftId");
  if (!draftId) badRequest("Missing draftId in path.");

  const draft = await getDraft(draftId);
  const [picks, { players, managers }] = await Promise.all([
    getDraftPicks(draftId),
    loadLeagueContext(draft.league_id),
  ]);

  const resolvedPicks = picks
    .map((pick) => {
      const manager =
        managers.byUserId.get(pick.picked_by) ??
        managers.byRosterId.get(Number(pick.roster_id)) ?? {
          user_id: pick.picked_by || null,
          display_name: "Unknown Manager",
          team_name: null,
        };

      const amount = pick.metadata?.amount ? Number(pick.metadata.amount) : null;

      return {
        round: pick.round,
        pick_no: pick.pick_no,
        draft_slot: pick.draft_slot,
        roster_id: Number(pick.roster_id),
        manager,
        player: resolvePlayer(pick.player_id, players),
        is_keeper: pick.is_keeper ?? false,
        auction_amount: Number.isFinite(amount) ? amount : null,
      };
    })
    .sort((a, b) => a.pick_no - b.pick_no);

  return c.json({
    draft_id: draft.draft_id,
    league_id: draft.league_id,
    season: draft.season,
    type: draft.type,
    status: draft.status,
    rounds: draft.settings?.rounds ?? null,
    start_time: draft.start_time ? new Date(draft.start_time).toISOString() : null,
    picks: resolvedPicks,
  });
}
