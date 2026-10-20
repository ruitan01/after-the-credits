import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAFT_KEY,
  STORAGE_KEY,
  clearDraft,
  deleteEntry,
  loadDraft,
  loadEntries,
  parseEntries,
  saveDraft,
  saveEntry,
  sortEntries,
  type Entry,
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

describe("loadEntries / saveEntry", () => {
  it("round-trips a saved entry", () => {
    const saved = saveEntry({ title: "Stalker", watchedOn: "2026-10-10", rating: 4, reflection: "Slow." });
    const result = loadEntries();
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.entries).toEqual([saved]);
  });

  it("does not overwrite entries written by another tab", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify([entry({ id: "from-other-tab" })]));
    saveEntry({ title: "Stalker", watchedOn: "2026-10-10", rating: 4, reflection: "" });
    const result = loadEntries();
    expect(result.status === "ok" && result.entries.map((e) => e.id)).toContain("from-other-tab");
  });

  it("backs up corrupt data instead of silently wiping it", () => {
    storage.setItem(STORAGE_KEY, "garbage");
    const result = loadEntries();
    expect(result).toEqual({ status: "ok", entries: [], recovered: true });
    const backupKey = storage.keys().find((k) => k.startsWith(`${STORAGE_KEY}:corrupt-`));
    expect(backupKey && storage.getItem(backupKey)).toBe("garbage");
  });

  it("backs up the original before dropping unreadable items", () => {
    const raw = JSON.stringify([entry({ id: "good" }), { broken: true }]);
    storage.setItem(STORAGE_KEY, raw);
    expect(loadEntries()).toMatchObject({ status: "ok", recovered: true });
    const backupKey = storage.keys().find((k) => k.startsWith(`${STORAGE_KEY}:corrupt-`));
    expect(backupKey && storage.getItem(backupKey)).toBe(raw);
    // The cleaned list is written back, so the notice doesn't repeat on every visit.
    expect(loadEntries()).toMatchObject({ status: "ok", recovered: false });
  });

  it("reports unavailable storage", () => {
    storage.failWrites = true;
    expect(loadEntries()).toEqual({ status: "unavailable" });
    expect(() => saveEntry({ title: "X", watchedOn: "2026-10-10", rating: 3, reflection: "" })).toThrow();
  });

  it("deletes a single entry", () => {
    storage.setItem(STORAGE_KEY, JSON.stringify([entry({ id: "keep" }), entry({ id: "gone" })]));
    deleteEntry("gone");
    const result = loadEntries();
    expect(result.status === "ok" && result.entries.map((e) => e.id)).toEqual(["keep"]);
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
