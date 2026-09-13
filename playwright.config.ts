import { defineConfig, devices } from "@playwright/test"
import { addMonths, format, startOfMonth } from "date-fns"

// Deterministic booking window for the specs: next month is fully open, so
// the calendar's first visible month is always bookable (see e2e/booking.spec.ts).
export const bookingWindowStart = startOfMonth(addMonths(new Date(), 1))

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
    env: {
      ...process.env,
      BOOKING_MIN_DATE: format(bookingWindowStart, "yyyy-MM-dd"),
      BOOKING_MAX_DATE: format(addMonths(bookingWindowStart, 3), "yyyy-MM-dd"),
      ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "e2e-admin-password",
      AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-dummy-auth-secret",
      AUTH_TRUST_HOST: "true",
    },
  },
})
