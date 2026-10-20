import { describe, expect, it } from "vitest";
import { daysBetween, describeDaysAgo, parseDay, toDayString } from "./date";
import { validateEntry, type EntryFormValues } from "./validate";

const TODAY = "2026-10-19";

const valid: EntryFormValues = {
  title: "In the Mood for Love",
  watchedOn: "2026-10-18",
  rating: "5",
  reflection: "",
};

describe("validateEntry", () => {
  it("accepts a complete entry with an empty reflection", () => {
    expect(validateEntry(valid, TODAY)).toEqual({});
  });

  it("reports every missing required field at once", () => {
    const errors = validateEntry({ title: "  ", watchedOn: "", rating: "", reflection: "" }, TODAY);
    expect(errors).toEqual({
      title: "Enter the film's title.",
      watchedOn: "Choose the date you watched it.",
      rating: "Choose a rating from 1 to 5.",
    });
  });

  it("limits title length after trimming", () => {
    expect(validateEntry({ ...valid, title: `  ${"a".repeat(120)}  ` }, TODAY).title).toBeUndefined();
    expect(validateEntry({ ...valid, title: "a".repeat(121) }, TODAY).title).toMatch(/under 120/);
  });

  it("allows today but rejects future dates", () => {
    expect(validateEntry({ ...valid, watchedOn: TODAY }, TODAY).watchedOn).toBeUndefined();
    expect(validateEntry({ ...valid, watchedOn: "2026-10-20" }, TODAY).watchedOn).toBe(
      "That date hasn't happened yet.",
    );
  });

  it("rejects dates before cinema existed and impossible dates", () => {
    expect(validateEntry({ ...valid, watchedOn: "1887-12-31" }, TODAY).watchedOn).toMatch(/1888/);
    expect(validateEntry({ ...valid, watchedOn: "1888-01-01" }, TODAY).watchedOn).toBeUndefined();
    expect(validateEntry({ ...valid, watchedOn: "2026-02-30" }, TODAY).watchedOn).toMatch(/real date/);
  });

  it("only accepts whole ratings from 1 to 5", () => {
    for (const rating of ["0", "6", "2.5", "abc"]) {
      expect(validateEntry({ ...valid, rating }, TODAY).rating).toBeDefined();
    }
    expect(validateEntry({ ...valid, rating: "1" }, TODAY).rating).toBeUndefined();
  });

  it("caps the optional reflection and reports the current length", () => {
    expect(validateEntry({ ...valid, reflection: "a".repeat(500) }, TODAY).reflection).toBeUndefined();
    expect(validateEntry({ ...valid, reflection: "a".repeat(532) }, TODAY).reflection).toBe(
      "Keep your reflection under 500 characters (you're at 532).",
    );
  });
});

describe("local dates", () => {
  it("formats the local calendar day, not the UTC one", () => {
    // 11:30pm local time must stay on the same day regardless of timezone.
    expect(toDayString(new Date(2026, 9, 18, 23, 30))).toBe("2026-10-18");
  });

  it("parses only real YYYY-MM-DD days", () => {
    expect(parseDay("2026-10-18")?.getDate()).toBe(18);
    expect(parseDay("2026-13-01")).toBeNull();
    expect(parseDay("18/10/2026")).toBeNull();
  });
});

describe("returning-visit wording", () => {
  it("counts calendar days, including across a daylight-saving change", () => {
    expect(daysBetween("2026-10-17", "2026-10-20")).toBe(3);
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("nope", "2026-10-20")).toBeNull();
  });

  it("describes the gap in plain words", () => {
    expect(describeDaysAgo(0)).toBe("earlier today");
    expect(describeDaysAgo(1)).toBe("yesterday");
    expect(describeDaysAgo(3)).toBe("3 days ago");
    expect(describeDaysAgo(20)).toBe("2 weeks ago");
    expect(describeDaysAgo(90)).toBe("a while ago");
  });
});
