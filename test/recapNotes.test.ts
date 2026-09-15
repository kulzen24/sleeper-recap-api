import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import type { Bindings } from "../src/bindings";
import {
  clearDraft,
  getNotesState,
  publishDraft,
  requireWriteToken,
  unpublish,
  updateDraft,
} from "../src/recapNotes";

class FakeKV {
  private store = new Map<string, string>();

  async get(key: string, type?: "json" | "text") {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    return type === "json" ? JSON.parse(raw) : raw;
  }

  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

function fakeKv() {
  return new FakeKV() as unknown as KVNamespace;
}

describe("getNotesState", () => {
  it("returns an empty draft and no published content when nothing is stored", async () => {
    const state = await getNotesState(fakeKv(), "league1", 1);
    expect(state).toEqual({
      week: 1,
      draft: { title: null, write_up: null, superlatives: [], updated_at: expect.any(String) },
      published: null,
    });
  });
});

describe("updateDraft", () => {
  it("merges a partial patch without clobbering fields the patch omits", async () => {
    const kv = fakeKv();

    await updateDraft(kv, "league1", 1, { write_up: "Great week." });
    const afterFirst = await getNotesState(kv, "league1", 1);
    expect(afterFirst.draft.write_up).toBe("Great week.");

    await updateDraft(kv, "league1", 1, {
      superlatives: [{ title: "Best Value", winner: "Alice", blurb: "$2 waiver pickup for 30 points." }],
    });
    const afterSecond = await getNotesState(kv, "league1", 1);

    expect(afterSecond.draft.write_up).toBe("Great week.");
    expect(afterSecond.draft.superlatives).toEqual([
      { title: "Best Value", winner: "Alice", blurb: "$2 waiver pickup for 30 points." },
    ]);
  });

  it("rejects a superlative missing a required string field", async () => {
    const kv = fakeKv();
    await expect(
      updateDraft(kv, "league1", 1, { superlatives: [{ title: "Best Value", winner: "Alice" }] }),
    ).rejects.toThrow(/blurb/);
  });

  it("rejects a non-array superlatives field", async () => {
    const kv = fakeKv();
    await expect(updateDraft(kv, "league1", 1, { superlatives: "nope" })).rejects.toThrow(/array/);
  });
});

describe("publishDraft / unpublish", () => {
  it("copies the current draft into published, leaving the draft intact", async () => {
    const kv = fakeKv();
    await updateDraft(kv, "league1", 1, { title: "Chaos Week", write_up: "It happened." });

    const published = await publishDraft(kv, "league1", 1);
    expect(published.published).toMatchObject({ title: "Chaos Week", write_up: "It happened." });
    expect(published.draft.title).toBe("Chaos Week");

    const unpublished = await unpublish(kv, "league1", 1);
    expect(unpublished.published).toBeNull();
    expect(unpublished.draft.title).toBe("Chaos Week");
  });
});

describe("clearDraft", () => {
  it("resets only the draft, not a previously published version", async () => {
    const kv = fakeKv();
    await updateDraft(kv, "league1", 1, { title: "Draft title" });
    await publishDraft(kv, "league1", 1);

    const cleared = await clearDraft(kv, "league1", 1);
    expect(cleared.draft.title).toBeNull();
    expect(cleared.published?.title).toBe("Draft title");
  });
});

function fakeContext(headers: Record<string, string>, token: string | undefined): Context<{ Bindings: Bindings }> {
  return {
    req: { header: (name: string) => headers[name.toLowerCase()] },
    env: { RECAP_WRITE_TOKEN: token },
  } as unknown as Context<{ Bindings: Bindings }>;
}

describe("requireWriteToken", () => {
  it("passes when the bearer token matches the configured secret", () => {
    const c = fakeContext({ authorization: "Bearer secret123" }, "secret123");
    expect(() => requireWriteToken(c)).not.toThrow();
  });

  it("throws 401 when the token is missing", () => {
    const c = fakeContext({}, "secret123");
    expect(() => requireWriteToken(c)).toThrow(/Authorization/);
  });

  it("throws 401 when the token doesn't match", () => {
    const c = fakeContext({ authorization: "Bearer wrong" }, "secret123");
    expect(() => requireWriteToken(c)).toThrow(/Authorization/);
  });

  it("throws 500 when no secret is configured on the server", () => {
    const c = fakeContext({ authorization: "Bearer anything" }, undefined);
    expect(() => requireWriteToken(c)).toThrow(/not configured/);
  });
});
