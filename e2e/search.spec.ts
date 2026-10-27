import { expect, test, type Page } from "@playwright/test";
import {
  ART,
  BARBIE,
  authFile,
  card,
  deleteTitles,
  film,
  rate,
  rowsTitled,
  stubPosters,
  stubSearch,
  titleField,
  uniqueTitle,
} from "./helpers";

test.use({ storageState: authFile("a") });

let created: string[] = [];
test.beforeEach(async ({ page }) => {
  created = [];
  await stubPosters(page);
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  if (created.length) await deleteTitles(page, created);
});

const listbox = (page: Page) => page.getByRole("listbox", { name: "Films on iTunes" });
const save = (page: Page) => page.getByRole("button", { name: "Save to diary" }).click();
const savedBanner = (page: Page) => page.getByRole("status").filter({ hasText: "is now in your diary" });

const BARBIE_RESULTS = [
  BARBIE,
  film("Barbie Fairytopia: Mermaidia", 564478840, { releaseYear: 2012, director: "Will Lau" }),
  film("Barbie & the Diamond Castle", 304168928, { releaseYear: 2008, director: "Unknown", artworkUrl: null }),
];

test.describe("suggestions", () => {
  test("shows title, year and director, and links the chosen film", async ({ page }) => {
    // A unique title keeps test rows apart; the stub returns it as the iTunes match.
    const title = uniqueTitle("Barbie");
    created.push(title);
    await stubSearch(page, [{ ...BARBIE, title }, ...BARBIE_RESULTS.slice(1)]);
    await page.goto("/log");

    await titleField(page).fill("barb");
    await expect(listbox(page)).toBeVisible();
    await expect(titleField(page)).toHaveAttribute("aria-expanded", "true");
    const options = listbox(page).getByRole("option");
    await expect(options).toHaveCount(3);
    await expect(options.first()).toContainText(title);
    await expect(options.first()).toContainText("2023 · Greta Gerwig");
    await expect(page.getByRole("status").filter({ hasText: "3 films found" })).toBeAttached();

    await options.first().click();
    await expect(titleField(page)).toHaveValue(title);
    await expect(titleField(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText("Linked to iTunes · 2023")).toBeVisible();

    await rate(page, 4);
    await save(page);
    await expect(savedBanner(page)).toBeVisible();
    const entry = card(page, title);
    await expect(entry.getByRole("heading")).toContainText("2023");
    await expect(entry.locator(`img[src="${ART}"]`)).toBeVisible();

    const [row] = await rowsTitled(page, title);
    expect(row).toMatchObject({ itunes_id: BARBIE.itunesId, release_year: 2023 });
  });

  test("editing the title after choosing removes the link", async ({ page }) => {
    const title = uniqueTitle("Edited after linking");
    created.push(title);
    await stubSearch(page, BARBIE_RESULTS);
    await page.goto("/log");
    await titleField(page).fill("barbie");
    await listbox(page).getByRole("option").first().click();
    await expect(page.getByText("Linked to iTunes · 2023")).toBeVisible();

    await stubSearch(page, []);
    await titleField(page).fill(title);
    await expect(page.getByText(/Linked to iTunes/)).toHaveCount(0);
    await rate(page, 3);
    await save(page);
    await expect(savedBanner(page)).toBeVisible();
    const [row] = await rowsTitled(page, title);
    expect(row).toMatchObject({ itunes_id: null, release_year: null });
    await expect(card(page, title).locator("img")).toHaveCount(0);
  });

  test("Unlink keeps the title and returns focus to the field", async ({ page }) => {
    await stubSearch(page, BARBIE_RESULTS);
    await page.goto("/log");
    await titleField(page).fill("barbie");
    await listbox(page).getByRole("option").first().click();
    await page.getByRole("button", { name: "Unlink from iTunes" }).click();
    await expect(page.getByText(/Linked to iTunes/)).toHaveCount(0);
    await expect(titleField(page)).toHaveValue("Barbie");
    await expect(titleField(page)).toBeFocused();
  });

  test("a chosen film is kept with the draft", async ({ page }) => {
    await stubSearch(page, BARBIE_RESULTS);
    await page.goto("/log");
    await titleField(page).fill("barbie");
    await listbox(page).getByRole("option").first().click();
    await page.getByRole("link", { name: "Back to diary" }).click();
    await page.goto("/log");
    await expect(titleField(page)).toHaveValue("Barbie");
    await expect(page.getByText("Linked to iTunes · 2023")).toBeVisible();
    await page.getByRole("button", { name: "Start over" }).click();
  });
});

test.describe("keyboard", () => {
  test("arrows move, Enter chooses without submitting, Escape closes, Tab moves on", async ({ page }) => {
    await stubSearch(page, BARBIE_RESULTS);
    await page.goto("/log");
    const field = titleField(page);
    await field.pressSequentially("barbie");
    await expect(listbox(page)).toBeVisible();

    await field.press("ArrowDown");
    await expect(field).toHaveAttribute("aria-activedescendant", "title-option-0");
    await expect(listbox(page).getByRole("option").nth(0)).toHaveAttribute("aria-selected", "true");
    await field.press("ArrowUp");
    await expect(field).toHaveAttribute("aria-activedescendant", "title-option-2");
    await field.press("ArrowDown");
    await expect(field).toHaveAttribute("aria-activedescendant", "title-option-0");
    await expect(field).toBeFocused();

    await field.press("Escape");
    await expect(listbox(page)).toHaveCount(0);
    await expect(field).toHaveValue("barbie");

    await field.press("ArrowDown");
    await expect(listbox(page)).toBeVisible();
    await field.press("ArrowDown");
    await field.press("Enter");
    await expect(field).toHaveValue("Barbie Fairytopia: Mermaidia");
    await expect(page).toHaveURL(/\/log$/);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await field.pressSequentially(" x");
    await expect(page.getByText(/Linked to iTunes/)).toHaveCount(0);
    await field.press("Tab");
    await expect(page.getByLabel("Date watched")).toBeFocused();
  });

  test("Enter with nothing highlighted submits the form as before", async ({ page }) => {
    await stubSearch(page, BARBIE_RESULTS);
    await page.goto("/log");
    await titleField(page).pressSequentially("barbie");
    await expect(listbox(page)).toBeVisible();
    await titleField(page).press("Enter");
    // Submitted: no rating yet, so validation answers.
    await expect(page.getByRole("alert")).toContainText("Choose a rating from 1 to 5.");
  });
});

test.describe("states, and manual entry whatever search does", () => {
  test("nothing found is a gentle note, not an error", async ({ page }) => {
    await stubSearch(page, []);
    await page.goto("/log");
    await titleField(page).fill("aftersun");
    await expect(page.getByText("No matches on iTunes. That's fine: keep typing and save it as is.")).toBeVisible();
    await expect(titleField(page)).toHaveAttribute("aria-expanded", "false");
    await titleField(page).press("ArrowDown");
    await expect(listbox(page)).toHaveCount(0);
  });

  for (const [name, answer] of [
    ["unavailable (502)", 502],
    ["rate-limited", 429],
    ["signed out mid-session (401)", 401],
  ] as const) {
    test(`search ${name}: says so, and the typed title still saves`, async ({ page }) => {
      const title = uniqueTitle(`Search ${answer}`);
      created.push(title);
      await stubSearch(page, answer);
      await page.goto("/log");
      await titleField(page).fill(title);
      await expect(
        page.getByText("Film search isn't available right now. You can still type the title yourself."),
      ).toBeVisible();
      await rate(page, 4);
      await save(page);
      await expect(savedBanner(page)).toBeVisible();
      await expect(card(page, title)).toBeVisible();
    });
  }

  test("network failure: same message, and saving still works", async ({ page }) => {
    const title = uniqueTitle("Search offline");
    created.push(title);
    await stubSearch(page, (route) => route.abort("internetdisconnected"));
    await page.goto("/log");
    await titleField(page).fill(title);
    await expect(page.getByText(/Film search isn't available right now/)).toBeVisible();
    await rate(page, 2);
    await save(page);
    await expect(card(page, title)).toBeVisible();
  });

  test("a slow search shows loading and never holds up saving", async ({ page }) => {
    const title = uniqueTitle("Slow search");
    created.push(title);
    await stubSearch(page, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 8000));
      await route.fulfill({ json: { results: [] } }).catch(() => {});
    });
    await page.goto("/log");
    await titleField(page).fill(title);
    await expect(page.getByText("Searching iTunes…")).toBeVisible();
    await rate(page, 5);
    await save(page);
    await expect(savedBanner(page)).toBeVisible();
    await expect(card(page, title)).toBeVisible();
  });
});

test.describe("live iTunes (real network)", () => {
  test("the search route returns Barbie (2023) for a signed-in user", async ({ page }) => {
    await page.goto("/");
    const response = await page.request.get("/api/films/search?q=barbie");
    expect(response.status()).toBe(200);
    const { results } = (await response.json()) as { results: { title: string; releaseYear: number | null }[] };
    expect(results.length).toBeLessThanOrEqual(8);
    expect(results[0]).toMatchObject({ title: "Barbie", releaseYear: 2023 });
  });

  test("the search route rejects a one-letter query", async ({ page }) => {
    await page.goto("/");
    expect((await page.request.get("/api/films/search?q=b")).status()).toBe(400);
  });

  test("typing in the form shows the real suggestion", async ({ page }) => {
    await page.goto("/log");
    await titleField(page).fill("barbie");
    await expect(listbox(page).getByRole("option").first()).toContainText("Barbie", { timeout: 15_000 });
    await expect(listbox(page).getByRole("option").first()).toContainText("2023");
    await titleField(page).fill("");
  });
});
