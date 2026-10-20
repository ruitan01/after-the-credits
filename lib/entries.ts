import { parseDay } from "./date";

export type Rating = 1 | 2 | 3 | 4 | 5;

export type Entry = {
  id: string;
  title: string;
  watchedOn: string; // YYYY-MM-DD, local
  rating: Rating;
  reflection: string;
  createdAt: string; // ISO timestamp
};

export type NewEntry = Omit<Entry, "id" | "createdAt">;

export const STORAGE_KEY = "after-the-credits:entries:v1";

export type LoadResult =
  | { status: "ok"; entries: Entry[]; recovered: boolean }
  | { status: "unavailable" };

export class StorageWriteError extends Error {}

function getStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function isEntry(value: unknown): value is Entry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    e.title.trim().length > 0 &&
    typeof e.watchedOn === "string" &&
    parseDay(e.watchedOn) !== null &&
    typeof e.rating === "number" &&
    Number.isInteger(e.rating) &&
    e.rating >= 1 &&
    e.rating <= 5 &&
    typeof e.reflection === "string" &&
    typeof e.createdAt === "string"
  );
}

/**
 * Parses the stored JSON. Invalid items are dropped; if the whole value is
 * unreadable, `corrupt` is true so the caller can back it up before replacing it.
 */
export function parseEntries(raw: string | null): { entries: Entry[]; corrupt: boolean; dropped: number } {
  if (raw === null) return { entries: [], corrupt: false, dropped: 0 };
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return { entries: [], corrupt: true, dropped: 0 };
    const entries = data.filter(isEntry);
    return { entries, corrupt: false, dropped: data.length - entries.length };
  } catch {
    return { entries: [], corrupt: true, dropped: 0 };
  }
}

/** Newest viewing first; entries logged for the same day keep newest-logged first. */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function loadEntries(): LoadResult {
  const storage = getStorage();
  if (!storage) return { status: "unavailable" };

  const raw = storage.getItem(STORAGE_KEY);
  const { entries, corrupt, dropped } = parseEntries(raw);
  if ((corrupt || dropped > 0) && raw !== null) {
    // Never silently wipe data: keep the unreadable value aside for recovery,
    // then keep only the entries that could be read.
    try {
      storage.setItem(`${STORAGE_KEY}:corrupt-${Date.now()}`, raw);
      if (corrupt) storage.removeItem(STORAGE_KEY);
      else storage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // Leave it in place if we can't back it up.
    }
  }
  return { status: "ok", entries: sortEntries(entries), recovered: corrupt || dropped > 0 };
}

function makeId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function writeEntries(storage: Storage, entries: Entry[]) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    throw new StorageWriteError("Could not write to localStorage.");
  }
}

/** Re-reads storage before writing so entries saved in another tab aren't overwritten. */
export function saveEntry(input: NewEntry): Entry {
  const storage = getStorage();
  if (!storage) throw new StorageWriteError("localStorage is unavailable.");

  const current = loadEntries();
  const existing = current.status === "ok" ? current.entries : [];
  const entry: Entry = { ...input, id: makeId(), createdAt: new Date().toISOString() };
  writeEntries(storage, sortEntries([entry, ...existing]));
  return entry;
}

export function deleteEntry(id: string): void {
  const storage = getStorage();
  if (!storage) throw new StorageWriteError("localStorage is unavailable.");

  const current = loadEntries();
  const existing = current.status === "ok" ? current.entries : [];
  writeEntries(storage, existing.filter((e) => e.id !== id));
}

// Unsaved form contents, so leaving /log by any link doesn't lose what was typed.
export const DRAFT_KEY = "after-the-credits:draft:v1";

export type Draft = { title: string; watchedOn: string; rating: string; reflection: string };

export function loadDraft(): Draft | null {
  try {
    const data: unknown = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null");
    if (typeof data !== "object" || data === null) return null;
    const d = data as Record<string, unknown>;
    const field = (v: unknown) => (typeof v === "string" ? v : "");
    return { title: field(d.title), watchedOn: field(d.watchedOn), rating: field(d.rating), reflection: field(d.reflection) };
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): void {
  try {
    const empty = !draft.title.trim() && !draft.rating && !draft.reflection.trim();
    if (empty) window.localStorage.removeItem(DRAFT_KEY);
    else window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // A draft is a convenience; failing to keep one must never block typing.
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
