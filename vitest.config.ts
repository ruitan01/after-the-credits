import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Matches the "@/*" path alias in tsconfig.json.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
});
