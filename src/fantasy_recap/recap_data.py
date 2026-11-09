import asyncio
from typing import Any

from .context import load_league_context
from .sleeper import get_matchups, get_transactions
from .standings import build_standings
from .transactions import resolve_transaction
from .util import round_to
from .week_matchups import build_matchup_groups

TOP_N = 5


def _team_summary(team: dict[str, Any]) -> dict[str, Any]:
    return {"roster_id": team["roster_id"], "manager": team["manager"], "team_score": team["team_score"]}


async def build_recap_data(league_id: str, week: int) -> dict[str, Any]:
    """Computes everything the /recap/:week JSON endpoint and the
    /recap-page/:week HTML page both need: matchups, notable performances,
    transactions, and standings. Kept separate from either handler so
    neither format duplicates this logic."""
    raw_matchups, raw_transactions, league_context = await asyncio.gather(
        get_matchups(league_id, week),
        get_transactions(league_id, week),
        load_league_context(league_id),
    )

    players, managers = league_context.players, league_context.managers
    matchups = build_matchup_groups(raw_matchups, players, managers)
    all_teams = [team for group in matchups for team in group["teams"]]

    highest_scoring_team = None
    lowest_scoring_team = None
    if all_teams:
        highest_scoring_team = _team_summary(max(all_teams, key=lambda t: t["team_score"]))
        lowest_scoring_team = _team_summary(min(all_teams, key=lambda t: t["team_score"]))

    head_to_head = [
        {
            "matchup_id": group["matchup_id"],
            "teams": [_team_summary(t) for t in group["teams"]],
            "margin": round_to(abs(group["teams"][0]["team_score"] - group["teams"][1]["team_score"])),
        }
        for group in matchups
        if len(group["teams"]) == 2
    ]

    closest_matchup = min(head_to_head, key=lambda m: m["margin"]) if head_to_head else None
    largest_margin = max(head_to_head, key=lambda m: m["margin"]) if head_to_head else None

    def top_players(slot: str) -> list[dict[str, Any]]:
        performances = [
            {**player, "manager": team["manager"]} for team in all_teams for player in team[slot]
        ]
        performances.sort(key=lambda p: -p["points"])
        return performances[:TOP_N]

    return {
        "week": week,
        "matchups": matchups,
        "summary": {
            "highest_scoring_team": highest_scoring_team,
            "lowest_scoring_team": lowest_scoring_team,
            "closest_matchup": closest_matchup,
            "largest_margin": largest_margin,
            "top_starter_performances": top_players("starters"),
            "highest_bench_scores": top_players("bench"),
        },
        "transactions": [resolve_transaction(t, players, managers) for t in raw_transactions],
        "standings": build_standings(league_context.rosters, managers),
    }
