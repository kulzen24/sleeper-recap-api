import type { ManagerDirectory } from "./resolvers";
import { resolvePlayer } from "./resolvers";
import type { ResolvedManager, ResolvedPlayer, SleeperPlayer, SleeperTransaction } from "./types";

const UNKNOWN_MANAGER: ResolvedManager = { user_id: null, display_name: "Unknown Manager", team_name: null };

function managerForRoster(rosterId: number, managers: ManagerDirectory): ResolvedManager {
  return managers.byRosterId.get(rosterId) ?? UNKNOWN_MANAGER;
}

export interface ResolvedTransaction {
  transaction_id: string;
  type: string;
  status: string;
  created: string;
  teams: ResolvedManager[];
  adds: Array<{ player: ResolvedPlayer; manager: ResolvedManager }>;
  drops: Array<{ player: ResolvedPlayer; manager: ResolvedManager }>;
  waiver_bid: number | null;
  draft_picks_traded: Array<{
    season: string;
    round: number;
    from: ResolvedManager;
    to: ResolvedManager;
  }>;
  faab_traded: Array<{ from: ResolvedManager; to: ResolvedManager; amount: number }>;
}

export function resolveTransaction(
  transaction: SleeperTransaction,
  players: Record<string, SleeperPlayer>,
  managers: ManagerDirectory,
): ResolvedTransaction {
  const adds = Object.entries(transaction.adds ?? {}).map(([playerId, rosterId]) => ({
    player: resolvePlayer(playerId, players),
    manager: managerForRoster(rosterId, managers),
  }));

  const drops = Object.entries(transaction.drops ?? {}).map(([playerId, rosterId]) => ({
    player: resolvePlayer(playerId, players),
    manager: managerForRoster(rosterId, managers),
  }));

  const draftPicksTraded = (transaction.draft_picks ?? []).map((pick) => ({
    season: pick.season,
    round: pick.round,
    from: managerForRoster(pick.previous_owner_id, managers),
    to: managerForRoster(pick.owner_id, managers),
  }));

  const faabTraded = (transaction.waiver_budget ?? []).map((budget) => ({
    from: managerForRoster(budget.sender, managers),
    to: managerForRoster(budget.receiver, managers),
    amount: budget.amount,
  }));

  return {
    transaction_id: transaction.transaction_id,
    type: transaction.type,
    status: transaction.status,
    created: new Date(transaction.created).toISOString(),
    teams: transaction.roster_ids.map((id) => managerForRoster(id, managers)),
    adds,
    drops,
    waiver_bid: transaction.settings?.waiver_bid ?? null,
    draft_picks_traded: draftPicksTraded,
    faab_traded: faabTraded,
  };
}
