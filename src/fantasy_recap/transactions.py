from typing import Any

from .resolvers import ManagerDirectory, resolve_player, unknown_manager
from .util import iso_from_ms


def _manager_for_roster(roster_id: int, managers: ManagerDirectory) -> dict[str, Any]:
    return managers.by_roster_id.get(roster_id) or unknown_manager()


def resolve_transaction(
    transaction: dict, players: dict[str, dict], managers: ManagerDirectory
) -> dict[str, Any]:
    def moves(field: str) -> list[dict[str, Any]]:
        return [
            {
                "player": resolve_player(player_id, players),
                "manager": _manager_for_roster(roster_id, managers),
            }
            for player_id, roster_id in (transaction.get(field) or {}).items()
        ]

    draft_picks_traded = [
        {
            "season": pick["season"],
            "round": pick["round"],
            "from": _manager_for_roster(pick["previous_owner_id"], managers),
            "to": _manager_for_roster(pick["owner_id"], managers),
        }
        for pick in transaction.get("draft_picks") or []
    ]

    faab_traded = [
        {
            "from": _manager_for_roster(budget["sender"], managers),
            "to": _manager_for_roster(budget["receiver"], managers),
            "amount": budget["amount"],
        }
        for budget in transaction.get("waiver_budget") or []
    ]

    return {
        "transaction_id": transaction["transaction_id"],
        "type": transaction["type"],
        "status": transaction["status"],
        "created": iso_from_ms(transaction["created"]),
        "teams": [_manager_for_roster(rid, managers) for rid in transaction.get("roster_ids") or []],
        "adds": moves("adds"),
        "drops": moves("drops"),
        "waiver_bid": (transaction.get("settings") or {}).get("waiver_bid"),
        "draft_picks_traded": draft_picks_traded,
        "faab_traded": faab_traded,
    }
