import { expect, test, type Page } from "@playwright/test";
import {
  authFile,
  card,
  deleteTitles,
  expectNoHorizontalOverflow,
  film,
  rate,
  searchMessage,
  stubPosters,
  stubSearch,
  titleField,
  uniqueTitle,
} from "./helpers";

// Runs in the mobile-375 and mobile-320 projects (phone widths, touch).

const width = (page: Page) => page.viewportSize()!.width;

async function expectInsideViewport(page: Page, locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(width(page) + 0.5);
}

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("the welcome fits the screen", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Start your diary/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("signed in", () => {
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

  test("the diary and the form fit the screen", async ({ page }) => {
    await stubSearch(page, []);
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.goto("/log");
    await expect(titleField(page)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    // 16px or more, so iOS doesn't zoom into the field.
    const fontSize = await titleField(page).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(fontSize).toBeGreaterThanOrEqual(16);
  });

  test("suggestions fit, scroll inside themselves, and can be tapped", async ({ page }) => {
    const title = uniqueTitle("Everything Everywhere All at Once: The Extended Anniversary Edition");
    created.push(title);
    await stubSearch(page, [
      film(title, 1, { releaseYear: 2022, director: "Daniel Kwan & Daniel Scheinert" }),
      ...Array.from({ length: 7 }, (_, i) => film(`Everything ${i} with a fairly long subtitle that has to wrap`, i + 2)),
    ]);
    await page.goto("/log");
    await titleField(page).fill("everything");
    const listbox = page.getByRole("listbox", { name: "Films on iTunes" });
    await expect(listbox).toBeVisible();
    await expectInsideViewport(page, listbox);
    await expectNoHorizontalOverflow(page);

    const options = listbox.getByRole("option");
    await expect(options).toHaveCount(8);
    for (const option of await options.all()) {
      const box = await option.boundingBox();
      if (box) expect(box.height, "touch target").toBeGreaterThanOrEqual(44);
    }
    const panelHeight = await listbox.evaluate((el) => el.parentElement!.getBoundingClientRect().height);
    expect(panelHeight).toBeLessThanOrEqual(page.viewportSize()!.height * 0.6 + 1);

    await options.first().tap();
    await expect(titleField(page)).toHaveValue(title);
    await expect(page.getByText("Linked to iTunes · 2022")).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await rate(page, 5);
    await page.getByRole("button", { name: "Save to diary" }).tap();
    const entry = card(page, title);
    await expect(entry).toBeVisible();
    await expect(entry.locator("img")).toBeVisible();
    await expectInsideViewport(page, entry);
    await expectNoHorizontalOverflow(page);
  });

  test("search messages fit too", async ({ page }) => {
    await stubSearch(page, 502);
    await page.goto("/log");
    await titleField(page).fill("anything at all");
    const message = searchMessage(page, /Film search isn't available right now/);
    await expect(message).toBeVisible();
    await expectInsideViewport(page, message);
    await expectNoHorizontalOverflow(page);
  });
});
