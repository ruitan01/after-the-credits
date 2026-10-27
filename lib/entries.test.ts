import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_KEY,
  STORAGE_KEY,
  clearDraft,
  ImportConflictError,
  deleteEntry,
  findLocalEntries,
  fromRow,
  importId,
  importLocalEntries,
  loadDraft,
  loadEntries,
  parseEntries,
  saveDraft,
  saveEntry,
  sortEntries,
  toImportRow,
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

// A stand-in for the Supabase query builder: records each call, and each
// awaited query resolves to the next result the test set up.
type Call = [method: string, ...args: unknown[]];
type Result = { data?: unknown; error?: { message: string } | null };
function fakeDb(...results: Result[]) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["from", "select", "order", "insert", "upsert", "single", "delete", "eq", "in"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) => {
    const result = results.shift() ?? {};
    return resolve({ data: result.data ?? null, error: result.error ?? null });
  };
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

describe("importing entries saved in this browser", () => {
  const A = "3f0c6a2e-1b7d-4c55-9a51-0d9a2b7e4f10";
  const B = "9b2d4e61-7c3a-4f08-8e5d-2a6c1f9b7d33";
  const seed = (items: unknown[]) => {
    const raw = JSON.stringify(items);
    storage.setItem(STORAGE_KEY, raw);
    return raw;
  };
  // What the upsert sent, so tests can answer the read-back check with the same ids.
  const sentIds = (calls: Call[]) =>
    (calls.find((c) => c[0] === "upsert")![1] as { id: string }[]).map((r) => r.id);

  it("offers nothing when there are no saved entries, or they can't be read", () => {
    expect(findLocalEntries()).toBeNull();
    storage.setItem(STORAGE_KEY, "garbage");
    expect(findLocalEntries()).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe("garbage");
  });

  it("counts only entries the account can accept, without changing storage", () => {
    const raw = seed([
      entry({ id: A }),
      entry({ id: B, title: "x".repeat(121) }),
      { broken: true },
    ]);
    const local = findLocalEntries();
    expect(local?.entries.map((e) => e.id)).toEqual([A]);
    expect(local?.skipped).toBe(2);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("keeps each entry's UUID, dates, rating, reflection and logged time", async () => {
    const row = await toImportRow(
      entry({ id: A.toUpperCase(), reflection: "Harry Dean Stanton.", createdAt: "2026-10-01T20:00:00.000Z" }),
    );
    expect(row).toEqual({
      id: A,
      title: "Paris, Texas",
      watched_on: "2026-10-01",
      rating: 5,
      reflection: "Harry Dean Stanton.",
      created_at: "2026-10-01T20:00:00.000Z",
    });
    expect(row).not.toHaveProperty("user_id");
  });

  it("lets the database time-stamp an entry whose logged time can't be read", async () => {
    const row = await toImportRow(entry({ id: A, createdAt: "sometime" }));
    expect(row).not.toHaveProperty("created_at");
  });

  it("gives an id that isn't a UUID the same new UUID every time", async () => {
    const first = await importId("lx3k9a-4f8e2b1c");
    expect(first).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await importId("lx3k9a-4f8e2b1c")).toBe(first);
    expect(await importId("lx3k9a-00000000")).not.toBe(first);
  });

  it("imports in one request that skips duplicates, then backs up and clears the original", async () => {
    const raw = seed([entry({ id: A }), entry({ id: B, watchedOn: "2026-09-12" })]);
    const { db, calls } = fakeDb({}, { data: [{ id: A }, { id: B }] });

    const result = await importLocalEntries(db);

    expect(result).toEqual({ imported: 2, skipped: 0, cleanedUp: true });
    const upserts = calls.filter((c) => c[0] === "upsert");
    expect(upserts).toHaveLength(1);
    expect(upserts[0][2]).toEqual({ onConflict: "id", ignoreDuplicates: true, defaultToNull: false });
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    const backup = storage.keys().find((k) => k.startsWith(`${STORAGE_KEY}:imported-`));
    expect(backup && storage.getItem(backup)).toBe(raw);
  });

  it("sends the same rows on a retry, so nothing is duplicated", async () => {
    seed([entry({ id: A }), entry({ id: "legacy-id" })]);
    const first = fakeDb({ error: { message: "network down" } });
    await expect(importLocalEntries(first.db)).rejects.toThrow();
    const ids = sentIds(first.calls);
    const second = fakeDb({}, { data: ids.map((id) => ({ id })) });
    await importLocalEntries(second.db);
    expect(sentIds(second.calls)).toEqual(ids);
  });

  it("leaves storage exactly as it was when the import fails", async () => {
    const raw = seed([entry({ id: A })]);
    const { db } = fakeDb({ error: { message: "new row violates row-level security policy" } });
    await expect(importLocalEntries(db)).rejects.toThrow("row-level security");
    expect(storage.keys()).toEqual([STORAGE_KEY]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("moves nothing if any entry doesn't read back as the user's own", async () => {
    const raw = seed([entry({ id: A }), entry({ id: B })]);
    // The insert "succeeds", but B already belongs to another account, so RLS hides it.
    const { db } = fakeDb({}, { data: [{ id: A }] });
    await expect(importLocalEntries(db)).rejects.toBeInstanceOf(ImportConflictError);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("keeps the original when it can't write the backup", async () => {
    const raw = seed([entry({ id: A })]);
    storage.failWrites = true;
    const result = await importLocalEntries(fakeDb({}, { data: [{ id: A }] }).db);
    expect(result.cleanedUp).toBe(false);
    expect(storage.keys()).toEqual([STORAGE_KEY]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
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
