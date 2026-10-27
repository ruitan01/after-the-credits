import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDay } from "./date";
import { REFLECTION_MAX, TITLE_MAX } from "./validate";

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
// Entries from Assignment 3 that are still in this browser. They're never
// imported or removed automatically: the user is offered the import, and the
// original key is removed only after every entry is safely in their account,
// with a copy kept under `…:imported-<timestamp>`.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = "after-the-credits:entries:v1";
const IMPORT_BATCH_CHECK = 100; // ids per verification query, to keep URLs short

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

// Mirrors the table's check constraints, so one bad entry can't fail the whole import.
function isImportable(entry: Entry): boolean {
  return entry.title.length <= TITLE_MAX && entry.reflection.length <= REFLECTION_MAX;
}

export type LocalEntries = { raw: string; entries: Entry[]; skipped: number };

/** Read-only look at this browser's Assignment 3 entries. Null when there's nothing to offer. */
export function findLocalEntries(): LocalEntries | null {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  const { entries, corrupt, dropped } = parseEntries(raw);
  if (raw === null || corrupt) return null;
  const importable = entries.filter(isImportable);
  if (importable.length === 0) return null;
  return { raw, entries: importable, skipped: dropped + entries.length - importable.length };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Entries keep their UUID so a repeated import is a no-op. Older ids that
 * aren't UUIDs get one derived from the id (SHA-256, formatted as a version 8
 * UUID), so retries send the same id instead of creating duplicates.
 */
export async function importId(localId: string): Promise<string> {
  if (UUID.test(localId)) return localId.toLowerCase();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${STORAGE_KEY}:${localId}`));
  const b = new Uint8Array(digest).slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x80;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function toImportRow(entry: Entry) {
  const created = Date.parse(entry.createdAt);
  return {
    id: await importId(entry.id),
    ...toRow(entry),
    // Keep when it was logged; if that was never recorded properly, the database uses now().
    ...(Number.isNaN(created) ? {} : { created_at: new Date(created).toISOString() }),
  };
}

/** Some of the entries already belong to another account, so nothing was moved. */
export class ImportConflictError extends EntryStoreError {}

export type ImportResult = { imported: number; skipped: number; cleanedUp: boolean };

/**
 * Adds this browser's entries to the signed-in user's account in one insert
 * (all or nothing), skipping any already there. Only once every entry reads
 * back as the user's own is the original key backed up and removed. On any
 * failure it throws and leaves localStorage exactly as it was.
 */
export async function importLocalEntries(db: SupabaseClient): Promise<ImportResult> {
  const local = findLocalEntries();
  if (!local) return { imported: 0, skipped: 0, cleanedUp: false };

  const rows = await Promise.all(local.entries.map(toImportRow));
  // One statement, so it's all or nothing. defaultToNull: false lets a row
  // without created_at take the column default instead of failing on null.
  const { error } = await db
    .from(TABLE)
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true, defaultToNull: false });
  if (error) throw new EntryStoreError(error.message);

  // RLS only returns the user's own rows, so a missing id means it belongs to someone else.
  const ids = [...new Set(rows.map((r) => r.id))];
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += IMPORT_BATCH_CHECK) {
    const { data, error: checkError } = await db
      .from(TABLE)
      .select("id")
      .in("id", ids.slice(i, i + IMPORT_BATCH_CHECK));
    if (checkError || !data) throw new EntryStoreError(checkError?.message ?? "Couldn't check the import.");
    for (const r of data as { id: string }[]) found.add(r.id);
  }
  if (ids.some((id) => !found.has(id))) {
    throw new ImportConflictError("Some entries belong to another account.");
  }

  return { imported: ids.length, skipped: local.skipped, cleanedUp: backUpAndClear(local.raw) };
}

function backUpAndClear(raw: string): boolean {
  try {
    const storage = window.localStorage;
    // Another tab may have changed it in the meantime; leave it for the next offer.
    if (storage.getItem(STORAGE_KEY) !== raw) return false;
    storage.setItem(`${STORAGE_KEY}:imported-${Date.now()}`, raw);
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    // The entries are in the account; the offer will reappear and re-importing is a no-op.
    return false;
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
