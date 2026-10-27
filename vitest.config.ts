import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

// Matches the "@/*" path alias in tsconfig.json. e2e/ holds Playwright specs,
// which `npm run test:e2e` runs instead.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: { exclude: [...configDefaults.exclude, "e2e/**"] },
});
