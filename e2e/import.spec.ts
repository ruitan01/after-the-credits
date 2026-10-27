import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { card, deleteTitles, rest, rowsTitled, signedIn, uniqueTitle } from "./helpers";

// Assignment 3 entries saved in a browser, imported into an account (Phase 3).
// Everything here runs in fresh, isolated browser contexts seeded with test
// entries; no real browser's localStorage is involved.

const KEY = "after-the-credits:entries:v1";

async function seed(page: Page, raw: string) {
  await page.goto("/");
  await page.evaluate(
    ({ key, raw }) => {
      window.localStorage.setItem(key, raw);
      window.sessionStorage.clear();
    },
    { key: KEY, raw },
  );
  await page.reload();
}

const storage = (page: Page) =>
  page.evaluate((key) => {
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith(key));
    return Object.fromEntries(keys.map((k) => [k, window.localStorage.getItem(k)]));
  }, KEY);

const offer = (page: Page) => page.getByText(/are saved in this browser only\. Add them to your account\?/);

test("imports once, keeps a backup, and never into a second account", async ({ browser }) => {
  const titles = [uniqueTitle("Imported Paris, Texas"), uniqueTitle("Imported Stalker")];
  const raw = JSON.stringify([
    { id: randomUUID(), title: titles[0], watchedOn: "2026-09-14", rating: 5, reflection: "Import test", createdAt: "2026-09-14T21:30:00.000Z" },
    // An Assignment 3 fallback id (not a UUID); the import derives a stable one.
    { id: `e2e-${Date.now().toString(36)}`, title: titles[1], watchedOn: "2026-08-02", rating: 4, reflection: "", createdAt: "2026-08-02T19:00:00.000Z" },
    { title: "unreadable" },
  ]);

  const a = await signedIn(browser, "a");
  const b = await signedIn(browser, "b");
  try {
    // Offered, never automatic; Not now hides it for this tab only.
    await seed(a.page, raw);
    await expect(offer(a.page)).toContainText("2 films");
    expect(await rowsTitled(a.page, titles[0])).toEqual([]);
    await a.page.getByRole("button", { name: "Not now" }).click();
    await expect(offer(a.page)).toHaveCount(0);
    await a.page.reload();
    await expect(offer(a.page)).toHaveCount(0);
    expect(await storage(a.page)).toEqual({ [KEY]: raw });

    // Add them: everything kept as it was, original key backed up and cleared.
    await a.page.evaluate(() => window.sessionStorage.clear());
    await a.page.reload();
    await a.page.getByRole("button", { name: "Add them" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "2 films were added to your diary" })).toContainText(
      "1 film couldn't be read",
    );
    for (const title of titles) await expect(card(a.page, title)).toBeVisible();
    const imported = await rest(a.page, `entries?select=title,watched_on,rating,reflection,created_at&title=eq.${encodeURIComponent(titles[0])}`);
    expect(imported.body).toEqual([
      { title: titles[0], watched_on: "2026-09-14", rating: 5, reflection: "Import test", created_at: "2026-09-14T21:30:00+00:00" },
    ]);
    const afterImport = await storage(a.page);
    expect(afterImport[KEY]).toBeUndefined();
    const backups = Object.entries(afterImport).filter(([k]) => k.startsWith(`${KEY}:imported-`));
    expect(backups).toHaveLength(1);
    expect(backups[0][1]).toBe(raw);

    // Importing the same entries again adds nothing.
    await seed(a.page, raw);
    await a.page.getByRole("button", { name: "Add them" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "were added to your diary" })).toBeVisible();
    for (const title of titles) expect(await rowsTitled(a.page, title)).toHaveLength(1);

    // Another account with the same browser data: refused, nothing moved.
    await seed(b.page, raw);
    await b.page.getByRole("button", { name: "Add them" }).click();
    await expect(b.page.getByRole("alert")).toContainText("already in a different account, so nothing was moved");
    expect(await storage(b.page)).toEqual({ [KEY]: raw });
    for (const title of titles) expect(await rowsTitled(b.page, title)).toEqual([]);
  } finally {
    await deleteTitles(a.page, titles);
    await deleteTitles(b.page, titles);
    await a.context.close();
    await b.context.close();
  }
});

test("a failed import changes nothing and can be retried", async ({ browser }) => {
  const title = uniqueTitle("Import retry");
  const raw = JSON.stringify([
    { id: randomUUID(), title, watchedOn: "2026-07-01", rating: 3, reflection: "", createdAt: "2026-07-01T18:00:00.000Z" },
  ]);
  const a = await signedIn(browser, "a");
  try {
    await seed(a.page, raw);
    await a.page.route(/\/rest\/v1\/entries/, (route) =>
      route.request().method() === "POST" ? route.abort("internetdisconnected") : route.fallback(),
    );
    await a.page.getByRole("button", { name: "Add them" }).click();
    await expect(a.page.getByRole("alert")).toContainText("We couldn't add your films, so nothing was changed.");
    expect(await storage(a.page)).toEqual({ [KEY]: raw });

    await a.page.unroute(/\/rest\/v1\/entries/);
    await a.page.getByRole("button", { name: "Try again" }).click();
    await expect(a.page.getByRole("status").filter({ hasText: "1 film was added to your diary" })).toBeVisible();
    expect(await rowsTitled(a.page, title)).toHaveLength(1);
  } finally {
    await deleteTitles(a.page, [title]);
    await a.context.close();
  }
});
