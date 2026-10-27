import { expect, test, type Page } from "@playwright/test";
import {
  clerkUserId,
  deleteTitles,
  logFilm,
  rest,
  rowsTitled,
  signedIn,
  stubSearch,
  uniqueTitle,
  type EntryRow,
  type TestUser,
} from "./helpers";

// Two Clerk users must never read, change or delete each other's entries.
// Every "can't" below is paired with the owner doing the same request
// successfully, so an empty answer means RLS said no, not that the request
// was malformed.
//
// To watch this fail (proving it can catch a leak), run with
// E2E_ISOLATION_SELF_CHECK=1: "the other user" becomes the owner, and the
// test must fail.
const SELF_CHECK = process.env.E2E_ISOLATION_SELF_CHECK === "1";

const diaryLoaded = (page: Page) =>
  page.getByRole("heading", { name: "Your diary" }).or(page.getByRole("link", { name: /Log your first film/ }));

for (const [owner, other] of [
  ["a", "b"],
  ["b", "a"],
] as [TestUser, TestUser][]) {
  test(`user ${other.toUpperCase()} can't read, change or delete user ${owner.toUpperCase()}'s entry`, async ({ browser }) => {
    const mine = await signedIn(browser, owner);
    const theirs = await signedIn(browser, SELF_CHECK ? owner : other);
    const title = uniqueTitle(`Private to ${owner.toUpperCase()}`);
    const forged = uniqueTitle(`Forged as ${owner.toUpperCase()}`);
    try {
      await stubSearch(mine.page, []);
      await logFilm(mine.page, title, { stars: 5, reflection: `Only ${owner.toUpperCase()} should ever see this.` });
      const ownerId = await clerkUserId(mine.page);
      const [row] = await rowsTitled(mine.page, title);
      expect(row.user_id).toBe(ownerId);

      await theirs.page.goto("/");
      await expect(diaryLoaded(theirs.page).first()).toBeVisible();
      if (!SELF_CHECK) expect(await clerkUserId(theirs.page)).not.toBe(ownerId);

      // Read: not in their diary, not by id, not by title, not in a full listing.
      await expect(theirs.page.getByRole("heading", { name: title })).toHaveCount(0);
      for (const query of [`entries?select=id&id=eq.${row.id}`, `entries?select=id&title=eq.${encodeURIComponent(title)}`]) {
        const owners = await rest(mine.page, query);
        expect(owners.body, "owner control: the same read works for the owner").toHaveLength(1);
        const others = await rest(theirs.page, query);
        expect(others.status).toBe(200);
        expect(others.body).toEqual([]);
      }
      const everything = await rest(theirs.page, "entries?select=id,user_id");
      expect((everything.body as EntryRow[]).filter((r) => r.id === row.id || r.user_id === ownerId)).toEqual([]);

      // Change: matches nothing, so nothing changes.
      const hijack = await rest(theirs.page, `entries?id=eq.${row.id}`, {
        method: "PATCH",
        body: { title: uniqueTitle("Hijacked"), rating: 1 },
        prefer: "return=representation",
      });
      expect(hijack.status).toBe(200);
      expect(hijack.body).toEqual([]);
      // Nobody can move a row to another user: user_id isn't updatable at all.
      const move = await rest(mine.page, `entries?id=eq.${row.id}`, {
        method: "PATCH",
        body: { user_id: "user_someone_else" },
        prefer: "return=representation",
      });
      expect(move.status).toBe(403);
      expect(move.body).toMatchObject({ code: "42501" });

      // Delete: matches nothing.
      const removal = await rest(theirs.page, `entries?id=eq.${row.id}`, { method: "DELETE", prefer: "return=representation" });
      expect(removal.body).toEqual([]);

      // Insert under the owner's id: rejected by the insert policy.
      const forgery = await rest(theirs.page, "entries", {
        method: "POST",
        body: { user_id: ownerId, title: forged, watched_on: "2026-10-01", rating: 3 },
        prefer: "return=minimal",
      });
      expect(forgery.status).toBe(403);
      expect(forgery.body).toMatchObject({ code: "42501" });

      // The owner's entry is exactly as it was.
      const [after] = await rowsTitled(mine.page, title);
      expect(after).toEqual(row);
      await mine.page.reload();
      await expect(mine.page.getByRole("heading", { name: title })).toBeVisible();
      await expect(mine.page.getByText(`Only ${owner.toUpperCase()} should ever see this.`)).toBeVisible();
    } finally {
      await deleteTitles(mine.page, [title, forged]);
      await deleteTitles(theirs.page, [forged]);
      await mine.context.close();
      await theirs.context.close();
    }
  });
}

test("without a session, the database answers nothing", async ({ browser }) => {
  const { context, page } = await signedIn(browser, "a");
  await page.goto("/");
  const anonymous = await rest(page, "entries?select=id", { anonymous: true });
  expect(anonymous.status).toBe(401);
  expect(anonymous.body).toMatchObject({ code: "42501" });
  await context.close();
});
