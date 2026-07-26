import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "e2e",
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // `next start` directly: the `npm start` script re-runs the schema
    // prescript, which CI already runs as an explicit step.
    command: "npx next start -p 3000",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
})
