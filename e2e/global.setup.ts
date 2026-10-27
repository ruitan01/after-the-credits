import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test as setup } from "@playwright/test";
import { authFile, testUserEmail, type TestUser } from "./helpers";

// Runs before every project. Gets a Clerk testing token (so bot protection
// doesn't block automated sign-in), then signs each dedicated test user in
// with a one-time ticket and saves the browser state for the tests to reuse.
// Needs CLERK_SECRET_KEY (already in .env.local) and the two E2E_USER_* emails.

setup.describe.configure({ mode: "serial" });

setup("get a Clerk testing token", async () => {
  await clerkSetup();
});

for (const user of ["a", "b"] as TestUser[]) {
  setup(`sign in test user ${user.toUpperCase()}`, async ({ page }) => {
    await page.goto("/");
    await clerk.signIn({ page, emailAddress: testUserEmail(user) });
    await page.goto("/");
    // Signed in: the header offers "Log a film" instead of "Sign in".
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: /Log a film/ })).toBeVisible();
    await page.context().storageState({ path: authFile(user) });
  });
}
