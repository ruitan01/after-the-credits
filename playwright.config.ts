import { loadEnvConfig } from "@next/env";
import { defineConfig, devices } from "@playwright/test";

// Load the same env files as `next dev` (.env.local is git-ignored). The test
// process needs the Clerk secret key to sign in the dedicated test users and
// the public Supabase values for direct REST checks. Nothing here prints them.
loadEnvConfig(process.cwd());

const baseURL = "http://localhost:3000";
const mobile = (width: number) => ({ ...devices["Desktop Chrome"], viewport: { width, height: 740 }, isMobile: true, hasTouch: true });

export default defineConfig({
  testDir: "e2e",
  // One worker: the tests share two Clerk test accounts and a dev server.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "desktop",
      testMatch: /\.spec\.ts$/,
      testIgnore: /mobile\.spec\.ts$/,
      dependencies: ["setup"],
      use: devices["Desktop Chrome"],
    },
    { name: "mobile-375", testMatch: /mobile\.spec\.ts$/, dependencies: ["setup"], use: mobile(375) },
    { name: "mobile-320", testMatch: /mobile\.spec\.ts$/, dependencies: ["setup"], use: mobile(320) },
  ],
  webServer: { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 180_000 },
});
