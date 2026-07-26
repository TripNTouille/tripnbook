import { test, expect } from "@playwright/test"

// Smoke: next-auth wiring — middleware redirect (proxy.ts), credentials
// sign-in, session-protected page, authenticated DB-backed API.
test("admin requires login, then shows the booking logs", async ({ page }) => {
  await page.goto("/admin")
  await expect(page).toHaveURL(/\/admin\/login$/)

  await page.getByPlaceholder("Mot de passe").fill(process.env.ADMIN_PASSWORD ?? "e2e-admin-password")
  await page.getByRole("button", { name: "Se connecter" }).click()

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole("heading", { name: "Administration" })).toBeVisible()

  // BookingLogsTable fetched /api/admin/booking-logs (authenticated, DB-backed)
  await expect(page.getByRole("button", { name: "Tous" })).toBeVisible()
})
