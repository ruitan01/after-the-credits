import { expect, test } from "@playwright/test";
import { authFile, card, deleteTitles, logFilm, rate, rowsTitled, stubSearch, titleField, uniqueTitle } from "./helpers";

test.use({ storageState: authFile("a") });

// Titles this test created; only these are cleaned up afterwards.
let created: string[] = [];
test.beforeEach(async ({ page }) => {
  created = [];
  // Typing titles would otherwise query iTunes for real; search has its own tests.
  await stubSearch(page, []);
});
test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: "ignoreErrors" });
  if (created.length) {
    if (page.url() === "about:blank") await page.goto("/");
    await deleteTitles(page, created);
  }
});

test("logs a film, keeps it after a reload, and deletes it", async ({ page }) => {
  const title = uniqueTitle("Paris, Texas");
  created.push(title);
  await logFilm(page, title, { stars: 4, reflection: "Harry Dean Stanton in the desert." });

  await expect(page).toHaveURL("/");
  const entry = card(page, title);
  await expect(entry).toBeVisible();
  await expect(entry.getByText("Rated 4 out of 5")).toBeAttached();
  await expect(entry.getByText("Harry Dean Stanton in the desert.")).toBeVisible();

  // Stored in Supabase, owned by this user, typed by hand so not linked.
  const [row] = await rowsTitled(page, title);
  expect(row).toMatchObject({ title, itunes_id: null, release_year: null });

  await page.reload();
  await expect(card(page, title)).toBeVisible();

  await card(page, title).getByRole("button", { name: `Delete ${title}` }).click();
  await card(page, title).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: `${title} was removed from your diary.` })).toBeVisible();
  await expect(card(page, title)).toHaveCount(0);
  await page.reload();
  await expect(card(page, title)).toHaveCount(0);
  expect(await rowsTitled(page, title)).toEqual([]);
});

test("Keep it cancels a delete", async ({ page }) => {
  const title = uniqueTitle("Keep");
  created.push(title);
  await logFilm(page, title);
  await card(page, title).getByRole("button", { name: `Delete ${title}` }).click();
  await card(page, title).getByRole("button", { name: "Keep it" }).click();
  await page.reload();
  await expect(card(page, title)).toBeVisible();
});

test("explains what's missing and focuses the first problem", async ({ page }) => {
  await page.goto("/log");
  await page.getByRole("button", { name: "Save to diary" }).click();
  const summary = page.getByRole("alert");
  await expect(summary).toContainText("Enter the film's title.");
  await expect(summary).toContainText("Choose a rating from 1 to 5.");
  await expect(titleField(page)).toBeFocused();
  await expect(titleField(page)).toHaveAttribute("aria-invalid", "true");
});

test.describe("drafts", () => {
  test("an unsaved entry survives leaving the page, and Start over clears it", async ({ page }) => {
    await page.goto("/log");
    await titleField(page).fill("E2E draft that is never saved");
    await rate(page, 3);
    await page.getByLabel(/Reflection/).fill("Half-written thought");
    await page.getByRole("link", { name: "Back to diary" }).click();
    await expect(page).toHaveURL("/");

    await page.goto("/log");
    await expect(page.getByText(/We kept the entry you hadn.t saved yet/)).toBeVisible();
    await expect(titleField(page)).toHaveValue("E2E draft that is never saved");
    await expect(page.getByRole("radio", { name: /^3 out of 5/ })).toBeChecked();
    await expect(page.getByLabel(/Reflection/)).toHaveValue("Half-written thought");

    await page.getByRole("button", { name: "Start over" }).click();
    await expect(titleField(page)).toHaveValue("");
    await page.reload();
    await expect(page.getByText(/We kept the entry/)).toHaveCount(0);
  });
});

test.describe("when the database can't be reached", () => {
  test("a failed save says so and keeps everything typed", async ({ page }) => {
    const title = uniqueTitle("Offline save");
    created.push(title);
    await page.goto("/log");
    await page.route(/\/rest\/v1\/entries/, (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback(),
    );
    await titleField(page).fill(title);
    await rate(page, 5);
    await page.getByLabel(/Reflection/).fill("Still here?");
    await page.getByRole("button", { name: "Save to diary" }).click();

    await expect(page.getByRole("alert")).toContainText("We couldn't save this entry.");
    await expect(page).toHaveURL(/\/log$/);
    await expect(titleField(page)).toHaveValue(title);
    await expect(page.getByLabel(/Reflection/)).toHaveValue("Still here?");

    // Back online: the same form saves.
    await page.unroute(/\/rest\/v1\/entries/);
    await page.getByRole("button", { name: "Save to diary" }).click();
    await expect(page.getByRole("status").filter({ hasText: "is now in your diary" })).toBeVisible();
    await expect(card(page, title)).toBeVisible();
  });

  test("the diary offers Try again", async ({ page }) => {
    await page.route(/\/rest\/v1\/entries/, (route) =>
      route.request().method() === "GET" ? route.fulfill({ status: 503, json: { message: "down" } }) : route.fallback(),
    );
    await page.goto("/");
    await expect(page.getByRole("alert")).toContainText(/Your diary can.t open right now/);
    await page.unroute(/\/rest\/v1\/entries/);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Log (your first film|what you.ve watched since)/ }).first()).toBeVisible();
  });
});
