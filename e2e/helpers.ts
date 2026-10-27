import { expect, type Browser, type Page, type Route } from "@playwright/test";
import type { Film } from "../lib/films";

// ---------------------------------------------------------------------------
// Test accounts. Two dedicated Clerk users in the development instance, set
// by the owner in .env.local. Never point these at a real diary account.
// ---------------------------------------------------------------------------

export type TestUser = "a" | "b";

export function testUserEmail(user: TestUser): string {
  const name = user === "a" ? "E2E_USER_A_EMAIL" : "E2E_USER_B_EMAIL";
  const email = process.env[name];
  if (!email) {
    throw new Error(
      `${name} is not set. Add two dedicated Clerk test users to .env.local ` +
        "(E2E_USER_A_EMAIL and E2E_USER_B_EMAIL); see e2e/README.md.",
    );
  }
  if (process.env.E2E_USER_A_EMAIL === process.env.E2E_USER_B_EMAIL) {
    throw new Error("E2E_USER_A_EMAIL and E2E_USER_B_EMAIL must be two different users.");
  }
  return email;
}

export const authFile = (user: TestUser) => `e2e/.auth/user-${user}.json`;

/** A new browser context already signed in as a test user. */
export async function signedIn(browser: Browser, user: TestUser) {
  const context = await browser.newContext({ storageState: authFile(user) });
  const page = await context.newPage();
  return { context, page };
}

// ---------------------------------------------------------------------------
// Test data. Every title the tests create starts with "E2E " plus a per-run
// id, and cleanup deletes only the exact titles or ids a test created.
// ---------------------------------------------------------------------------

const RUN = Date.now().toString(36);

export function uniqueTitle(label: string): string {
  return `E2E ${RUN} ${label} ${Math.random().toString(36).slice(2, 6)}`;
}

// ---------------------------------------------------------------------------
// Supabase REST, called from inside the page with that user's own Clerk
// session token and the publishable key, exactly as the app does. RLS applies.
// ---------------------------------------------------------------------------

type ClerkWindow = {
  Clerk: {
    loaded: boolean;
    user?: { id: string } | null;
    session?: { getToken(): Promise<string | null> } | null;
  };
};

export type RestResult = { status: number; body: unknown };

export async function rest(
  page: Page,
  path: string,
  init: { method?: string; body?: unknown; prefer?: string; anonymous?: boolean } = {},
): Promise<RestResult> {
  await page.waitForFunction(() => (window as unknown as ClerkWindow).Clerk?.loaded === true);
  return page.evaluate(
    async ({ url, key, path, init }) => {
      const clerk = (window as unknown as ClerkWindow).Clerk;
      const token = init.anonymous ? null : await clerk.session?.getToken();
      const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (init.prefer) headers.Prefer = init.prefer;
      const response = await fetch(`${url}/rest/v1/${path}`, {
        method: init.method ?? "GET",
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const text = await response.text();
      let body: unknown = text;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        // Leave non-JSON bodies as text.
      }
      return { status: response.status, body };
    },
    {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      path,
      init,
    },
  );
}

export async function clerkUserId(page: Page): Promise<string> {
  await page.waitForFunction(() => Boolean((window as unknown as ClerkWindow).Clerk?.user));
  return page.evaluate(() => (window as unknown as ClerkWindow).Clerk.user!.id);
}

export type EntryRow = { id: string; user_id: string; title: string; itunes_id: number | null; release_year: number | null };

/** The signed-in user's own rows with this exact title (RLS hides everyone else's). */
export async function rowsTitled(page: Page, title: string): Promise<EntryRow[]> {
  const result = await rest(page, `entries?select=id,user_id,title,itunes_id,release_year&title=eq.${encodeURIComponent(title)}`);
  expect(result.status).toBe(200);
  return result.body as EntryRow[];
}

/** Deletes only rows with these exact titles, as their owner. Never anything else. */
export async function deleteTitles(page: Page, titles: string[]) {
  for (const title of titles) {
    if (!title.startsWith("E2E ")) throw new Error(`Refusing to delete a non-test entry: ${title}`);
    await rest(page, `entries?title=eq.${encodeURIComponent(title)}`, { method: "DELETE" });
  }
}

export async function deleteIds(page: Page, ids: string[]) {
  for (const id of ids) await rest(page, `entries?id=eq.${id}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// The form.
// ---------------------------------------------------------------------------

export const titleField = (page: Page) => page.getByRole("combobox", { name: "Film title" });

export async function rate(page: Page, stars: number) {
  // The radios are visually hidden behind star icons, as for a real user's label click.
  await page.getByRole("radio", { name: new RegExp(`^${stars} out of 5`) }).check({ force: true });
}

/** Logs a film through /log and waits for the diary's "now in your diary" banner. */
export async function logFilm(page: Page, title: string, { stars = 4, reflection = "" } = {}) {
  await page.goto("/log");
  await titleField(page).fill(title);
  await rate(page, stars);
  if (reflection) await page.getByLabel(/Reflection/).fill(reflection);
  await page.getByRole("button", { name: "Save to diary" }).click();
  await expect(page.getByRole("status").filter({ hasText: "is now in your diary" })).toBeVisible();
}

/**
 * A search message as shown in the suggestion panel. The same words are also
 * in a visually hidden live region for screen readers; this skips that copy.
 */
export const searchMessage = (page: Page, text: string | RegExp) =>
  page.locator("p:not([role='status'])").filter({ hasText: text });

/** The app's alerts. Scoped to <main>: Next.js adds its own empty role="alert" route announcer to every page. */
export const appAlert = (page: Page) => page.getByRole("main").getByRole("alert");

export const card = (page: Page, title: string) =>
  page.getByRole("article").filter({ has: page.getByRole("heading", { name: title }) });

// ---------------------------------------------------------------------------
// iTunes search, stubbed at the browser so UI states are deterministic.
// ---------------------------------------------------------------------------

export const ART = "https://is1-ssl.mzstatic.com/image/thumb/e2e/pr_source.lsr/200x200bb.jpg";

export const BARBIE: Film = {
  itunesId: 1692915162,
  title: "Barbie",
  director: "Greta Gerwig",
  releaseYear: 2023,
  artworkUrl: ART,
  genre: "Comedy",
};

export const film = (title: string, itunesId: number, extra: Partial<Film> = {}): Film => ({
  ...BARBIE,
  itunesId,
  title,
  ...extra,
});

// 1×1 transparent PNG, served for any mzstatic.com poster during tests.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export async function stubPosters(page: Page) {
  await page.route(/^https:\/\/[^/]+\.mzstatic\.com\//, (route) => route.fulfill({ contentType: "image/png", body: PNG }));
}

/** Answers /api/films/search in the browser: a list of films, a status code, or a custom handler. */
export async function stubSearch(page: Page, answer: unknown[] | number | ((route: Route) => Promise<void>)) {
  await page.unroute("**/api/films/search**");
  await page.route("**/api/films/search**", async (route) => {
    if (typeof answer === "function") return answer(route);
    if (typeof answer === "number") return route.fulfill({ status: answer, json: { error: "unavailable" } });
    return route.fulfill({ json: { results: answer } });
  });
}

/** Fails if the page scrolls sideways at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, "page is wider than the viewport").toBeLessThanOrEqual(innerWidth);
}
