// iTunes Search results, trimmed to what the diary uses and ranked by how well
// the title matches what was typed. Pure functions only: the route handler and
// the form both use them, and they're tested without a network.

export type Film = {
  itunesId: number;
  title: string;
  director: string;
  releaseYear: number | null;
  artworkUrl: string | null;
  genre: string;
};

/** What an entry keeps from the film it was linked to. */
export type FilmLink = Pick<Film, "itunesId" | "artworkUrl" | "releaseYear">;

export const QUERY_MIN = 2;
export const QUERY_MAX = 100;
export const MAX_SUGGESTIONS = 8;
const EARLIEST_YEAR = 1888;
const LATEST_YEAR = 2100;

/** Trimmed, single-spaced query, or null if it's too short or too long to search. */
export function cleanQuery(raw: string | null): string | null {
  const q = (raw ?? "").trim().replace(/\s+/g, " ");
  return q.length >= QUERY_MIN && q.length <= QUERY_MAX ? q : null;
}

/** Lowercase, accents removed, "&" read as "and", punctuation as spaces. */
export function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Only Apple's image CDN over https; anything else isn't shown or stored. */
export function isArtworkUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".mzstatic.com");
  } catch {
    return false;
  }
}

function isYear(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= EARLIEST_YEAR && (value as number) <= LATEST_YEAR;
}

export function isFilmLink(value: unknown): value is FilmLink {
  if (typeof value !== "object" || value === null) return false;
  const f = value as Record<string, unknown>;
  return (
    Number.isSafeInteger(f.itunesId) &&
    (f.itunesId as number) > 0 &&
    (f.artworkUrl === null || isArtworkUrl(f.artworkUrl)) &&
    (f.releaseYear === null || isYear(f.releaseYear))
  );
}

/**
 * Keeps feature films with an id and a title. Returns null when the response
 * isn't shaped like an iTunes search at all, so the caller can report the
 * service as unavailable rather than "nothing found".
 */
export function parseItunes(json: unknown): Film[] | null {
  if (typeof json !== "object" || json === null) return null;
  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;

  const films: Film[] = [];
  for (const item of results) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    if (r.kind !== "feature-movie") continue;
    if (!Number.isSafeInteger(r.trackId) || (r.trackId as number) <= 0) continue;
    if (typeof r.trackName !== "string" || !r.trackName.trim()) continue;
    const year = typeof r.releaseDate === "string" ? Number(r.releaseDate.slice(0, 4)) : NaN;
    films.push({
      itunesId: r.trackId as number,
      title: r.trackName.trim(),
      director: typeof r.artistName === "string" ? r.artistName : "",
      releaseYear: isYear(year) ? year : null,
      // "…/100x100bb.jpg" is a bounding box; 200 keeps posters sharp on dense screens.
      artworkUrl: isArtworkUrl(r.artworkUrl100) ? r.artworkUrl100.replace(/\/100x100bb\./, "/200x200bb.") : null,
      genre: typeof r.primaryGenreName === "string" ? r.primaryGenreName : "",
    });
  }
  return films;
}

// Small words people often leave out or add; they don't decide relevance.
const FILLER = new Set(["the", "a", "an", "of", "and", "la", "le", "les", "el", "los", "das", "der", "die"]);
const ARTICLE = /^(the|a|an) /;

/**
 * How well a title matches the query: 0 exact, 1 starts with it, 2 every
 * query word starts a title word (any order), 3 matches once spaces and
 * punctuation are ignored. Null means unrelated; those are never suggested.
 */
export function matchScore(title: string, query: string): number | null {
  const t = normalise(title);
  const q = normalise(query);
  if (!q) return null;
  const bareT = t.replace(ARTICLE, "");
  const bareQ = q.replace(ARTICLE, "");
  if (t === q || bareT === bareQ) return 0;
  if (t.startsWith(q) || bareT.startsWith(bareQ)) return 1;

  const titleWords = t.split(" ");
  const queryWords = q.split(" ").filter((w) => !FILLER.has(w));
  const words = queryWords.length > 0 ? queryWords : q.split(" ");
  if (words.every((w) => titleWords.some((tw) => tw.startsWith(w)))) return 2;

  const compactQ = q.replace(/ /g, "");
  if (compactQ.length >= 3 && t.replace(/ /g, "").includes(compactQ)) return 3;
  return null;
}

/** Relevant films only, best match first (iTunes order breaks ties), no repeats, at most eight. */
export function rankFilms(films: Film[], query: string): Film[] {
  const seen = new Set<number>();
  return films
    .map((film, index) => ({ film, index, score: matchScore(film.title, query) }))
    .filter((r): r is { film: Film; index: number; score: number } => r.score !== null)
    .filter(({ film }) => !seen.has(film.itunesId) && Boolean(seen.add(film.itunesId)))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ film }) => film);
}
