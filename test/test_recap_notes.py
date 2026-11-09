import unittest

from fantasy_recap.errors import ApiError
from fantasy_recap.recap_notes import (
    clear_draft,
    get_notes_state,
    publish_draft,
    require_write_token,
    unpublish,
    update_draft,
)


class FakeKV:
    """Mimics the Workers KV binding's text get/put."""

    def __init__(self):
        self.store: dict[str, str] = {}

    async def get(self, key):
        return self.store.get(key)

    async def put(self, key, value):
        self.store[key] = value


class GetNotesStateTest(unittest.IsolatedAsyncioTestCase):
    async def test_returns_empty_draft_and_no_published_content_when_nothing_is_stored(self):
        state = await get_notes_state(FakeKV(), "league1", 1)
        self.assertEqual(state["week"], 1)
        self.assertEqual(
            {k: v for k, v in state["draft"].items() if k != "updated_at"},
            {"title": None, "write_up": None, "superlatives": []},
        )
        self.assertIsInstance(state["draft"]["updated_at"], str)
        self.assertIsNone(state["published"])


class UpdateDraftTest(unittest.IsolatedAsyncioTestCase):
    async def test_merges_a_partial_patch_without_clobbering_omitted_fields(self):
        kv = FakeKV()

        await update_draft(kv, "league1", 1, {"write_up": "Great week."})
        after_first = await get_notes_state(kv, "league1", 1)
        self.assertEqual(after_first["draft"]["write_up"], "Great week.")

        superlative = {"title": "Best Value", "winner": "Alice", "blurb": "$2 waiver pickup for 30 points."}
        await update_draft(kv, "league1", 1, {"superlatives": [superlative]})
        after_second = await get_notes_state(kv, "league1", 1)

        self.assertEqual(after_second["draft"]["write_up"], "Great week.")
        self.assertEqual(after_second["draft"]["superlatives"], [superlative])

    async def test_rejects_a_superlative_missing_a_required_string_field(self):
        with self.assertRaisesRegex(ApiError, "blurb"):
            await update_draft(FakeKV(), "league1", 1, {"superlatives": [{"title": "Best Value", "winner": "Alice"}]})

    async def test_rejects_a_non_array_superlatives_field(self):
        with self.assertRaisesRegex(ApiError, "array"):
            await update_draft(FakeKV(), "league1", 1, {"superlatives": "nope"})


class PublishTest(unittest.IsolatedAsyncioTestCase):
    async def test_copies_the_draft_into_published_leaving_the_draft_intact(self):
        kv = FakeKV()
        await update_draft(kv, "league1", 1, {"title": "Chaos Week", "write_up": "It happened."})

        published = await publish_draft(kv, "league1", 1)
        self.assertEqual(published["published"]["title"], "Chaos Week")
        self.assertEqual(published["published"]["write_up"], "It happened.")
        self.assertEqual(published["draft"]["title"], "Chaos Week")

        unpublished = await unpublish(kv, "league1", 1)
        self.assertIsNone(unpublished["published"])
        self.assertEqual(unpublished["draft"]["title"], "Chaos Week")


class ClearDraftTest(unittest.IsolatedAsyncioTestCase):
    async def test_resets_only_the_draft_not_a_previously_published_version(self):
        kv = FakeKV()
        await update_draft(kv, "league1", 1, {"title": "Draft title"})
        await publish_draft(kv, "league1", 1)

        cleared = await clear_draft(kv, "league1", 1)
        self.assertIsNone(cleared["draft"]["title"])
        self.assertEqual(cleared["published"]["title"], "Draft title")


class RequireWriteTokenTest(unittest.TestCase):
    def test_passes_when_the_bearer_token_matches(self):
        require_write_token("Bearer secret123", "secret123")

    def test_raises_401_when_the_token_is_missing(self):
        with self.assertRaisesRegex(ApiError, "Authorization") as ctx:
            require_write_token(None, "secret123")
        self.assertEqual(ctx.exception.status, 401)

    def test_raises_401_when_the_token_does_not_match(self):
        with self.assertRaisesRegex(ApiError, "Authorization"):
            require_write_token("Bearer wrong", "secret123")

    def test_raises_500_when_no_secret_is_configured(self):
        with self.assertRaisesRegex(ApiError, "not configured") as ctx:
            require_write_token("Bearer anything", None)
        self.assertEqual(ctx.exception.status, 500)
