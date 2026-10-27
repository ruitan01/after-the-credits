import { auth } from "@clerk/nextjs/server";
import { cleanQuery, parseItunes, rankFilms } from "@/lib/films";

// GET /api/films/search?q=… → { results: Film[] }
//
// Server-side so a ~450 KB iTunes response becomes a few KB, identical
// searches are cached for a day, and only signed-in users can search.
// Apple allows roughly 20 requests a minute per IP, and on Vercel every user
// shares the server's IP, so the cache matters. Any failure (network, timeout,
// rate limit, bad response) is a 502; the form treats that as "search
// unavailable" and manual entry carries on.

const ITUNES_SEARCH = "https://itunes.apple.com/search";
const CACHE_SECONDS = 60 * 60 * 24;
const TIMEOUT_MS = 5000;

const unavailable = () => Response.json({ error: "unavailable" }, { status: 502 });

export async function GET(request: Request) {
  // middleware.ts already protects /api/*; checked here too so this route never answers signed-out callers.
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "signed-out" }, { status: 401 });

  const q = cleanQuery(new URL(request.url).searchParams.get("q"));
  if (!q) return Response.json({ error: "query" }, { status: 400 });

  // Lowercased so "Barbie" and "barbie" share one cache entry.
  const params = new URLSearchParams({ term: q.toLowerCase(), media: "all", limit: "200", country: "US" });
  let json: unknown;
  try {
    const response = await fetch(`${ITUNES_SEARCH}?${params}`, {
      next: { revalidate: CACHE_SECONDS },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return unavailable();
    json = await response.json();
  } catch {
    return unavailable();
  }

  const films = parseItunes(json);
  if (!films) return unavailable();
  return Response.json(
    { results: rankFilms(films, q) },
    { headers: { "Cache-Control": "private, max-age=3600" } },
  );
}
