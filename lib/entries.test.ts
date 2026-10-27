import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_KEY,
  STORAGE_KEY,
  clearDraft,
  deleteEntry,
  fromRow,
  loadDraft,
  loadEntries,
  parseEntries,
  saveDraft,
  saveEntry,
  sortEntries,
  toRow,
  type Entry,
  type EntryRow,
} from "./entries";

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
    this.data.set(key, value);
  }
  keys() {
    return [...this.data.keys()];
  }
}

const entry = (overrides: Partial<Entry> = {}): Entry => ({
  id: "a",
  title: "Paris, Texas",
  watchedOn: "2026-10-01",
  rating: 5,
  reflection: "",
  createdAt: "2026-10-01T20:00:00.000Z",
  ...overrides,
});

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("window", { localStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseEntries", () => {
  it("treats a missing key as an empty diary", () => {
    expect(parseEntries(null)).toEqual({ entries: [], corrupt: false, dropped: 0 });
  });

  it("flags unreadable JSON and non-arrays as corrupt", () => {
    expect(parseEntries("garbage").corrupt).toBe(true);
    expect(parseEntries('{"a":1}').corrupt).toBe(true);
  });

  it("drops malformed items but keeps valid ones", () => {
    const raw = JSON.stringify([entry(), { title: "no id" }, entry({ id: "b", rating: 9 as never })]);
    const result = parseEntries(raw);
    expect(result.entries.map((e) => e.id)).toEqual(["a"]);
    expect(result.dropped).toBe(2);
  });
});

describe("sortEntries", () => {
  it("orders by viewing date, newest first, then by when it was logged", () => {
    const sorted = sortEntries([
      entry({ id: "old", watchedOn: "2025-01-01" }),
      entry({ id: "same-early", watchedOn: "2026-10-05", createdAt: "2026-10-05T10:00:00Z" }),
      entry({ id: "same-late", watchedOn: "2026-10-05", createdAt: "2026-10-05T22:00:00Z" }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["same-late", "same-early", "old"]);
  });
});

// A stand-in for the Supabase query builder: records each call and resolves
// to the result the test sets up.
type Call = [method: string, ...args: unknown[]];
function fakeDb(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "order", "insert", "single", "delete", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    resolve({ data: result.data ?? null, error: result.error ?? null });
  return { db: builder as unknown as SupabaseClient, calls };
}

const row = (overrides: Partial<EntryRow> = {}): EntryRow => ({
  id: "3f0c6a2e-1b7d-4c55-9a51-0d9a2b7e4f10",
  title: "Paris, Texas",
  watched_on: "2026-10-01",
  rating: 5,
  reflection: "",
  created_at: "2026-10-01T20:00:00.123456+00:00",
  ...overrides,
});

describe("row mapping", () => {
  it("maps a database row to an Entry with a normalised timestamp", () => {
    expect(fromRow(row())).toEqual({
      id: "3f0c6a2e-1b7d-4c55-9a51-0d9a2b7e4f10",
      title: "Paris, Texas",
      watchedOn: "2026-10-01",
      rating: 5,
      reflection: "",
      createdAt: "2026-10-01T20:00:00.123Z",
    });
  });

  it("never sends user_id; the database takes it from the session token", () => {
    const sent = toRow({ title: "Stalker", watchedOn: "2026-10-10", rating: 4, reflection: "Slow." });
    expect(sent).toEqual({ title: "Stalker", watched_on: "2026-10-10", rating: 4, reflection: "Slow." });
    expect(sent).not.toHaveProperty("user_id");
  });
});

describe("loadEntries / saveEntry / deleteEntry", () => {
  it("loads entries newest viewing first", async () => {
    const { db, calls } = fakeDb({
      data: [row({ id: "old", watched_on: "2025-01-01" }), row({ id: "new", watched_on: "2026-10-05" })],
    });
    const result = await loadEntries(db);
    expect(result.status === "ok" && result.entries.map((e) => e.id)).toEqual(["new", "old"]);
    expect(calls[0]).toEqual(["from", "entries"]);
  });

  it("reports the diary as unavailable when the request fails", async () => {
    const { db } = fakeDb({ error: { message: "permission denied for table entries" } });
    expect(await loadEntries(db)).toEqual({ status: "unavailable" });
  });

  it("returns the saved entry as the database stored it", async () => {
    const { db, calls } = fakeDb({ data: row({ title: "Stalker" }) });
    const saved = await saveEntry(db, { title: "Stalker", watchedOn: "2026-10-01", rating: 5, reflection: "" });
    expect(saved.title).toBe("Stalker");
    expect(calls).toContainEqual(["insert", { title: "Stalker", watched_on: "2026-10-01", rating: 5, reflection: "" }]);
  });

  it("throws when a save is rejected, so the form can keep what was typed", async () => {
    const { db } = fakeDb({ error: { message: "new row violates row-level security policy" } });
    await expect(
      saveEntry(db, { title: "X", watchedOn: "2026-10-10", rating: 3, reflection: "" }),
    ).rejects.toThrow("row-level security");
  });

  it("deletes a single entry by id", async () => {
    const { db, calls } = fakeDb({});
    await deleteEntry(db, "gone");
    expect(calls).toEqual([["from", "entries"], ["delete"], ["eq", "id", "gone"]]);
  });

  it("leaves entries saved in this browser untouched (they wait for the Phase 3 import)", async () => {
    const local = JSON.stringify([entry({ id: "from-assignment-3" })]);
    storage.setItem(STORAGE_KEY, local);
    await loadEntries(fakeDb({ data: [] }).db);
    await saveEntry(fakeDb({ data: row() }).db, { title: "X", watchedOn: "2026-10-10", rating: 3, reflection: "" });
    await deleteEntry(fakeDb({}).db, "from-assignment-3");
    expect(storage.getItem(STORAGE_KEY)).toBe(local);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
  });
});

describe("drafts", () => {
  it("keeps a non-empty draft and forgets an empty one", () => {
    saveDraft({ title: "Aftersun", watchedOn: "2026-10-17", rating: "", reflection: "" });
    expect(loadDraft()?.title).toBe("Aftersun");
    saveDraft({ title: "  ", watchedOn: "2026-10-17", rating: "", reflection: "" });
    expect(loadDraft()).toBeNull();
    saveDraft({ title: "X", watchedOn: "", rating: "3", reflection: "" });
    clearDraft();
    expect(loadDraft()).toBeNull();
  });

  it("ignores a malformed draft", () => {
    storage.setItem(DRAFT_KEY, "not json");
    expect(loadDraft()).toBeNull();
  });
});
