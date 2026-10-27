import type { SupabaseClient } from "@supabase/supabase-js";
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

export type LoadResult = { status: "ok"; entries: Entry[] } | { status: "unavailable" };

// ---------------------------------------------------------------------------
// Diary entries live in Supabase (`public.entries`). Row-level security limits
// every query to the signed-in user's rows, so nothing here filters by user,
// and `user_id` is never sent: the database fills it in from the Clerk token.
// ---------------------------------------------------------------------------

const TABLE = "entries";
const COLUMNS = "id, title, watched_on, rating, reflection, created_at";

export type EntryRow = {
  id: string;
  title: string;
  watched_on: string;
  rating: number;
  reflection: string;
  created_at: string;
};

export function fromRow(row: EntryRow): Entry {
  return {
    id: row.id,
    title: row.title,
    watchedOn: row.watched_on,
    rating: row.rating as Rating,
    reflection: row.reflection,
    // Postgres returns "…+00:00" with microseconds; normalise so sorting and
    // date maths match entries created in this browser.
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export function toRow(input: NewEntry) {
  return {
    title: input.title,
    watched_on: input.watchedOn,
    rating: input.rating,
    reflection: input.reflection,
  };
}

export class EntryStoreError extends Error {}

/** Newest viewing first; entries logged for the same day keep newest-logged first. */
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) => b.watchedOn.localeCompare(a.watchedOn) || b.createdAt.localeCompare(a.createdAt),
  );
}

export async function loadEntries(db: SupabaseClient): Promise<LoadResult> {
  const { data, error } = await db
    .from(TABLE)
    .select(COLUMNS)
    .order("watched_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (error || !data) return { status: "unavailable" };
  return { status: "ok", entries: sortEntries((data as EntryRow[]).map(fromRow)) };
}

export async function saveEntry(db: SupabaseClient, input: NewEntry): Promise<Entry> {
  const { data, error } = await db.from(TABLE).insert(toRow(input)).select(COLUMNS).single();
  if (error || !data) throw new EntryStoreError(error?.message ?? "The entry wasn't saved.");
  return fromRow(data as EntryRow);
}

export async function deleteEntry(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from(TABLE).delete().eq("id", id);
  if (error) throw new EntryStoreError(error.message);
}

// ---------------------------------------------------------------------------
// Entries from Assignment 3 that are still in this browser. Phase 2 never reads
// or writes them; these read-only parsers are kept for the Phase 3 import.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "after-the-credits:entries:v1";

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

/** Parses the stored JSON. Invalid items are dropped; an unreadable value sets `corrupt`. */
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
