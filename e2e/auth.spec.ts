import { expect, test } from "@playwright/test";
import { signedIn } from "./helpers";

test.describe("signed out", () => {
  test("the home page is the welcome, with sign-in and sign-up and no diary", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Every film leaves something behind/);
    await expect(page.getByRole("link", { name: /Start your diary/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "I already have one" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(0);
    await expect(page.getByText("saved in this browser only")).toHaveCount(0);
  });

  test("/log sends you to sign in", async ({ page }) => {
    await page.goto("/log");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("film search refuses signed-out callers", async ({ request }) => {
    const response = await request.get("/api/films/search?q=barbie");
    expect([401, 404]).toContain(response.status());
    expect(await response.text()).not.toContain('"results"');
  });

  test("the database refuses requests without a signed-in user", async ({ request }) => {
    const response = await request.get(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/entries?select=id`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toMatchObject({ code: "42501" });
  });
});

test.describe("signed in", () => {
  test("the header shows the diary links and the account menu", async ({ browser }) => {
    const { context, page } = await signedIn(browser, "a");
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Diary" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: /Log a film/ })).toBeVisible();
    await expect(nav.getByRole("button", { name: /user/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Sign in" })).toHaveCount(0);
    await context.close();
  });

  test("/log opens the form", async ({ browser }) => {
    const { context, page } = await signedIn(browser, "a");
    await page.goto("/log");
    await expect(page.getByRole("heading", { name: "What did you watch?" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Film title" })).toBeFocused();
    await context.close();
  });
});
