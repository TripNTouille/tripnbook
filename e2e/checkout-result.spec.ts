import { test, expect, type Page } from "@playwright/test"
import { addDays, format } from "date-fns"
import { bookingWindowStart } from "../playwright.config"

// Client-only behaviour of the room page: the dialog shown when Stripe
// redirects back (?checkout=success|cancelled), and the calendar switching
// between 3 months (desktop) and 1 month (mobile). /api/busy-dates and
// /api/checkout/session are mocked at the network layer.

async function roomPath(page: Page): Promise<string> {
  await page.goto("/")
  await expect(page).toHaveURL(/\/rooms\/\d+$/)
  return new URL(page.url()).pathname
}

test.beforeEach(async ({ page }) => {
  await page.route("**/api/busy-dates**", (route) =>
    route.fulfill({ json: { dates: [] } }),
  )
})

test("cancelled checkout: shows the cancellation dialog and cleans the URL", async ({ page }) => {
  const path = await roomPath(page)

  await page.goto(`${path}?checkout=cancelled&session_id=cs_test_e2e`)

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Réservation annulée")).toBeVisible()
  // A refresh must not re-open the dialog
  await expect(page).toHaveURL(new RegExp(`${path}$`))

  await dialog.getByRole("button", { name: "Fermer" }).first().click()
  await expect(dialog).toBeHidden()
})

test("successful checkout: shows the booking summary and cleans the URL", async ({ page }) => {
  const fromDate = addDays(bookingWindowStart, 9)
  const toDate = addDays(bookingWindowStart, 11)

  await page.route("**/api/checkout/session**", (route) =>
    route.fulfill({
      json: {
        paymentStatus: "paid",
        customerEmail: "jean@example.com",
        amountTotal: 24000,
        metadata: {
          roomName: "Tante Aimée",
          adultsCount: "2",
          childrenCount: "0",
          fromDate: format(fromDate, "yyyy-MM-dd"),
          toDate: format(toDate, "yyyy-MM-dd"),
          nightCount: "2",
          phone: "+33612345678",
          specialNeeds: "",
        },
      },
    }),
  )

  const path = await roomPath(page)
  await page.goto(`${path}?checkout=success&session_id=cs_test_e2e`)

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Réservation confirmée !")).toBeVisible()
  await expect(dialog.getByText("jean@example.com")).toBeVisible()
  await expect(dialog.getByText("Tante Aimée")).toBeVisible()
  await expect(dialog.getByText("(2 nuits)")).toBeVisible()
  await expect(dialog.getByText("240 €")).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${path}$`))
})

test("calendar shows 3 months on desktop and follows a resize to mobile", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await roomPath(page)
  await expect(page.getByRole("grid")).toHaveCount(3)

  await page.setViewportSize({ width: 375, height: 800 })
  await expect(page.getByRole("grid")).toHaveCount(1)
})

test("calendar shows 1 month when loaded on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await roomPath(page)
  await expect(page.getByRole("grid")).toHaveCount(1)
})
