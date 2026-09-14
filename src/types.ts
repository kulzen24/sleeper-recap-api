// ---------------------------------------------------------------------------
// Raw Sleeper API shapes (only the fields this project actually reads).
// Source of truth: https://docs.sleeper.com/
// ---------------------------------------------------------------------------

export interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  season_type: string;
  status: string;
  sport: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  settings: Record<string, number>;
  previous_league_id: string | null;
}

export interface SleeperUser {
  user_id: string;
  display_name: string;
  is_owner: boolean | null;
  metadata: { team_name?: string } | null;
}

export interface SleeperRosterSettings {
  wins: number;
  losses: number;
  ties: number;
  fpts: number;
  fpts_decimal?: number;
  fpts_against?: number;
  fpts_against_decimal?: number;
  waiver_position?: number;
  waiver_budget_used?: number;
  total_moves?: number;
}

export interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  co_owners?: string[] | null;
  league_id: string;
  players: string[] | null;
  starters: string[] | null;
  reserve?: string[] | null;
  taxi?: string[] | null;
  settings: SleeperRosterSettings;
}

export interface SleeperMatchup {
  matchup_id: number | null;
  roster_id: number;
  points: number;
  custom_points: number | null;
  starters: string[];
  players: string[];
  starters_points?: number[];
  players_points?: Record<string, number>;
}

export interface SleeperDraftPickMetadata {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  team?: string;
  amount?: string;
}

export interface SleeperDraftPick {
  round: number;
  pick_no: number;
  draft_slot: number;
  roster_id: number | string;
  picked_by: string;
  player_id: string;
  is_keeper: boolean | null;
  metadata: SleeperDraftPickMetadata | null;
}

export interface SleeperDraft {
  draft_id: string;
  league_id: string;
  season: string;
  season_type: string;
  status: string;
  type: string;
  start_time: number | null;
  created: number;
  settings: Record<string, number>;
  metadata: { name?: string; scoring_type?: string; description?: string } | null;
  draft_order: Record<string, number> | null;
  slot_to_roster_id: Record<string, number> | null;
}

export interface SleeperTransaction {
  transaction_id: string;
  type: "trade" | "free_agent" | "waiver";
  status: string;
  created: number;
  leg: number;
  roster_ids: number[];
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: Array<{
    season: string;
    round: number;
    roster_id: number;
    previous_owner_id: number;
    owner_id: number;
  }>;
  waiver_budget: Array<{ sender: number; receiver: number; amount: number }>;
  settings: { waiver_bid?: number } | null;
}

export interface SleeperPlayer {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  position: string | null;
  team: string | null;
  status?: string;
  active?: boolean;
  fantasy_positions?: string[];
}

export interface SleeperNflState {
  week: number;
  season: string;
  season_type: string;
  display_week: number;
}

// ---------------------------------------------------------------------------
// Clean, resolved shapes returned by this API.
// ---------------------------------------------------------------------------

export interface ResolvedManager {
  user_id: string | null;
  display_name: string;
  team_name: string | null;
}

export interface ResolvedPlayer {
  player_id: string | null;
  name: string;
  position: string | null;
  team: string | null;
}

export interface ApiErrorBody {
  error: string;
  status: number;
  detail?: string;
}
