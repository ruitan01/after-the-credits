import { describe, expect, it } from "vitest";
import {
  MAX_SUGGESTIONS,
  cleanQuery,
  isArtworkUrl,
  isFilmLink,
  matchScore,
  normalise,
  parseItunes,
  rankFilms,
  type Film,
} from "./films";

const ART = "https://is1-ssl.mzstatic.com/image/thumb/Video/v4/aa/bb/cc/pr_source.lsr/100x100bb.jpg";

const raw = (overrides: Record<string, unknown> = {}) => ({
  kind: "feature-movie",
  trackId: 1692915162,
  trackName: "Barbie",
  artistName: "Greta Gerwig",
  releaseDate: "2023-07-21T07:00:00Z",
  artworkUrl100: ART,
  primaryGenreName: "Comedy",
  trackPrice: 19.99,
  previewUrl: "https://example.com/preview.m4v",
  ...overrides,
});

const film = (title: string, itunesId = Math.floor(Math.random() * 1e9) + 1): Film => ({
  itunesId,
  title,
  director: "",
  releaseYear: null,
  artworkUrl: null,
  genre: "",
});

const titles = (films: Film[]) => films.map((f) => f.title);

describe("cleanQuery", () => {
  it("trims and collapses spaces, and rejects queries too short or too long to search", () => {
    expect(cleanQuery("  past   lives ")).toBe("past lives");
    expect(cleanQuery("a")).toBeNull();
    expect(cleanQuery("   ")).toBeNull();
    expect(cleanQuery(null)).toBeNull();
    expect(cleanQuery("x".repeat(101))).toBeNull();
  });
});

describe("parseItunes", () => {
  it("keeps only the fields the diary uses, with a year and a larger poster", () => {
    expect(parseItunes({ resultCount: 1, results: [raw()] })).toEqual([
      {
        itunesId: 1692915162,
        title: "Barbie",
        director: "Greta Gerwig",
        releaseYear: 2023,
        artworkUrl: ART.replace("100x100bb", "200x200bb"),
        genre: "Comedy",
      },
    ]);
  });

  it("keeps feature films only and skips malformed items", () => {
    const films = parseItunes({
      results: [
        raw({ kind: "song" }),
        raw({ kind: "podcast" }),
        raw({ trackId: "123" }),
        raw({ trackId: -1 }),
        raw({ trackName: "  " }),
        null,
        "nonsense",
        raw({ trackId: 7, trackName: "Kept" }),
      ],
    });
    expect(films?.map((f) => f.itunesId)).toEqual([7]);
  });

  it("drops artwork that isn't https on Apple's image CDN, and years that make no sense", () => {
    const [a, b, c] = parseItunes({
      results: [
        raw({ trackId: 1, artworkUrl100: "http://is1-ssl.mzstatic.com/x/100x100bb.jpg" }),
        raw({ trackId: 2, artworkUrl100: "https://evil.example.com/100x100bb.jpg", releaseDate: "0001-01-01" }),
        raw({ trackId: 3, artworkUrl100: undefined, releaseDate: undefined }),
      ],
    })!;
    expect([a.artworkUrl, b.artworkUrl, c.artworkUrl]).toEqual([null, null, null]);
    expect([b.releaseYear, c.releaseYear]).toEqual([null, null]);
  });

  it("treats nothing found as an empty list, but an unrecognisable response as null", () => {
    expect(parseItunes({ resultCount: 0, results: [] })).toEqual([]);
    expect(parseItunes({ errorMessage: "Invalid value(s) for key(s): [term]" })).toBeNull();
    expect(parseItunes("<html>")).toBeNull();
    expect(parseItunes(null)).toBeNull();
  });
});

describe("search relevance", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalise("Amélie")).toBe("amelie");
    expect(normalise("Spider-Man: Across the Spider-Verse")).toBe("spider man across the spider verse");
    expect(normalise("Fast & Furious")).toBe("fast and furious");
  });

  it("ranks exact, then starts-with, then every word, then ignoring spaces", () => {
    expect(matchScore("Barbie", "barbie")).toBe(0);
    expect(matchScore("The Dark Knight", "dark knight")).toBe(0);
    expect(matchScore("Barbie & the Diamond Castle", "barbie")).toBe(1);
    expect(matchScore("Barbie", "barb")).toBe(1);
    expect(matchScore("The Dark Knight Rises", "knight dark")).toBe(2);
    expect(matchScore("Spider-Man", "spiderman")).toBe(3);
  });

  it("finds legitimate partial titles while they're still being typed", () => {
    expect(matchScore("Inception", "incep")).not.toBeNull();
    expect(matchScore("Everything Everywhere All at Once", "everything every")).not.toBeNull();
    expect(matchScore("Portrait of a Lady on Fire", "portrait lady")).not.toBeNull();
    expect(matchScore("Amélie", "amelie")).not.toBeNull();
    expect(matchScore("The Lord of the Rings: The Return of the King", "lord rings return")).not.toBeNull();
  });

  it("rejects unrelated titles instead of filling the list", () => {
    expect(matchScore("Ring of Fire (IMAX)", "inception")).toBeNull();
    expect(matchScore("Destiny: An Unauthorized Story On Prince William", "inception")).toBeNull();
    expect(matchScore("Barbie", "barbie oppenheimer")).toBeNull();
    expect(matchScore("Up", "pu")).toBeNull();
  });

  it("returns nothing when iTunes only sends unrelated films (the 'inception' case)", () => {
    const unrelated = [film("Ring of Fire (IMAX)"), film("Ayrton Senna: Unauthorized & Complete")];
    expect(rankFilms(unrelated, "inception")).toEqual([]);
  });

  it("orders by match strength, keeps iTunes order for ties, removes repeats and caps the list", () => {
    const films = [
      film("Barbie Fairytopia: Mermaidia", 1),
      film("Barbie", 2),
      film("The Barbie Diaries", 3),
      film("Barbie & the Diamond Castle", 4),
      film("Barbie", 2),
      film("Unrelated", 5),
    ];
    // A leading "The" doesn't count, so "The Barbie Diaries" starts with "barbie" too.
    expect(titles(rankFilms(films, "barbie"))).toEqual([
      "Barbie",
      "Barbie Fairytopia: Mermaidia",
      "The Barbie Diaries",
      "Barbie & the Diamond Castle",
    ]);
    expect(titles(rankFilms([film("Mermaid Barbie"), film("Barbie Girl")], "barbie"))).toEqual([
      "Barbie Girl",
      "Mermaid Barbie",
    ]);
    const many = Array.from({ length: 20 }, (_, i) => film(`Barbie ${i}`, i + 100));
    expect(rankFilms(many, "barbie")).toHaveLength(MAX_SUGGESTIONS);
  });
});

describe("isFilmLink / isArtworkUrl", () => {
  it("accepts a link from a search result, with or without artwork and year", () => {
    expect(isFilmLink({ itunesId: 1692915162, artworkUrl: ART, releaseYear: 2023 })).toBe(true);
    expect(isFilmLink({ itunesId: 1692915162, artworkUrl: null, releaseYear: null })).toBe(true);
  });

  it("rejects anything that couldn't have come from a search result", () => {
    expect(isFilmLink(null)).toBe(false);
    expect(isFilmLink({ itunesId: "1", artworkUrl: null, releaseYear: null })).toBe(false);
    expect(isFilmLink({ itunesId: 1, artworkUrl: "javascript:alert(1)", releaseYear: null })).toBe(false);
    expect(isFilmLink({ itunesId: 1, artworkUrl: null, releaseYear: 99999 })).toBe(false);
    expect(isArtworkUrl("https://mzstatic.com.evil.example/x.jpg")).toBe(false);
  });
});
