import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => auth() }));

const { GET } = await import("./route");

const ART = "https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg";
const barbie = {
  kind: "feature-movie",
  trackId: 1692915162,
  trackName: "Barbie",
  artistName: "Greta Gerwig",
  releaseDate: "2023-07-21T07:00:00Z",
  artworkUrl100: ART,
  primaryGenreName: "Comedy",
};

const search = (q?: string) =>
  GET(new Request(`http://localhost:3000/api/films/search${q === undefined ? "" : `?q=${encodeURIComponent(q)}`}`));

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  auth.mockResolvedValue({ userId: "user_test" });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("GET /api/films/search", () => {
  it("refuses signed-out callers without calling iTunes", async () => {
    auth.mockResolvedValue({ userId: null });
    const response = await search("barbie");
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a missing, too-short or too-long query without calling iTunes", async () => {
    for (const q of [undefined, "", "a", "x".repeat(101)]) {
      expect((await search(q)).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("asks iTunes the way that works, with a day's cache and a timeout", async () => {
    fetchMock.mockResolvedValue(Response.json({ resultCount: 0, results: [] }));
    await search("  Past Lives ");
    const [url, init] = fetchMock.mock.calls[0];
    const params = new URL(url).searchParams;
    expect(Object.fromEntries(params)).toEqual({ term: "past lives", media: "all", limit: "200", country: "US" });
    expect(init.next).toEqual({ revalidate: 86400 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns trimmed, relevant results", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ resultCount: 2, results: [barbie, { ...barbie, trackId: 9, trackName: "Unrelated" }] }),
    );
    const response = await search("barbie");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=3600");
    expect(await response.json()).toEqual({
      results: [
        {
          itunesId: 1692915162,
          title: "Barbie",
          director: "Greta Gerwig",
          releaseYear: 2023,
          artworkUrl: ART.replace("100x100bb", "200x200bb"),
          genre: "Comedy",
        },
      ],
    });
  });

  it("treats nothing found as an empty list, not an error", async () => {
    fetchMock.mockResolvedValue(Response.json({ resultCount: 0, results: [] }));
    const response = await search("aftersun");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ results: [] });
  });

  describe("reports iTunes as unavailable (502)", () => {
    const cases: [string, () => unknown][] = [
      ["when the network fails", () => fetchMock.mockRejectedValue(new TypeError("fetch failed"))],
      ["when the request times out", () => fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"))],
      ["when Apple rate-limits", () => fetchMock.mockResolvedValue(new Response("", { status: 429 }))],
      ["when Apple refuses", () => fetchMock.mockResolvedValue(new Response("", { status: 403 }))],
      ["on a server error", () => fetchMock.mockResolvedValue(new Response("", { status: 503 }))],
      ["when the body isn't JSON", () => fetchMock.mockResolvedValue(new Response("<html>busy</html>"))],
      ["when the JSON isn't a search result", () => fetchMock.mockResolvedValue(Response.json({ errorMessage: "x" }))],
    ];
    for (const [name, arrange] of cases) {
      it(name, async () => {
        arrange();
        const response = await search("barbie");
        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: "unavailable" });
      });
    }
  });
});
