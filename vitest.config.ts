import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    // Keep vitest away from the Playwright specs in e2e/
    include: ["lib/**/*.test.ts"],
  },
})
