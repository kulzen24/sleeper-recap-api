import unittest

from fantasy_recap.resolvers import build_manager_directory
from fantasy_recap.transactions import resolve_transaction

from .test_resolvers import roster

PLAYERS = {
    "p1": {"player_id": "p1", "full_name": "Add Guy", "position": "WR", "team": "AAA"},
    "p2": {"player_id": "p2", "full_name": "Drop Guy", "position": "RB", "team": "BBB"},
}
USERS = [
    {"user_id": "u1", "display_name": "Alice", "is_owner": None, "metadata": None},
    {"user_id": "u2", "display_name": "Bob", "is_owner": None, "metadata": None},
]
MANAGERS = build_manager_directory(USERS, [roster(1, "u1"), roster(2, "u2")])
ALICE = {"user_id": "u1", "display_name": "Alice", "team_name": None}
BOB = {"user_id": "u2", "display_name": "Bob", "team_name": None}


class ResolveTransactionTest(unittest.TestCase):
    def test_resolves_a_waiver_claim(self):
        transaction = {
            "transaction_id": "t1",
            "type": "waiver",
            "status": "complete",
            "created": 1700000000000,
            "leg": 1,
            "roster_ids": [1],
            "adds": {"p1": 1},
            "drops": {"p2": 1},
            "draft_picks": [],
            "waiver_budget": [],
            "settings": {"waiver_bid": 12},
        }
        result = resolve_transaction(transaction, PLAYERS, MANAGERS)

        self.assertEqual(
            result["adds"],
            [{"player": {"player_id": "p1", "name": "Add Guy", "position": "WR", "team": "AAA"}, "manager": ALICE}],
        )
        self.assertEqual(
            result["drops"],
            [{"player": {"player_id": "p2", "name": "Drop Guy", "position": "RB", "team": "BBB"}, "manager": ALICE}],
        )
        self.assertEqual(result["waiver_bid"], 12)
        self.assertEqual(result["created"], "2023-11-14T22:13:20.000Z")

    def test_resolves_traded_draft_picks_and_faab(self):
        transaction = {
            "transaction_id": "t2",
            "type": "trade",
            "status": "complete",
            "created": 1700000000000,
            "leg": 1,
            "roster_ids": [1, 2],
            "adds": None,
            "drops": None,
            "draft_picks": [{"season": "2027", "round": 1, "roster_id": 1, "previous_owner_id": 1, "owner_id": 2}],
            "waiver_budget": [{"sender": 2, "receiver": 1, "amount": 25}],
            "settings": None,
        }
        result = resolve_transaction(transaction, PLAYERS, MANAGERS)

        self.assertEqual(result["draft_picks_traded"], [{"season": "2027", "round": 1, "from": ALICE, "to": BOB}])
        self.assertEqual(result["faab_traded"], [{"from": BOB, "to": ALICE, "amount": 25}])
