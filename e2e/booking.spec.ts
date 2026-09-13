import { test, expect } from "@playwright/test"
import { addDays, format } from "date-fns"
import { bookingWindowStart } from "../playwright.config"

// Smoke: the full client-side booking flow — calendar, guest selector,
// pricing dialog, checkout POST. External services (Google Calendar via
// /api/busy-dates, Stripe via /api/checkout) are mocked at the network
// layer; their server logic is unit-tested in lib/checkout.test.ts.
test("booking flow: pick dates, see price, submit checkout", async ({ page }) => {
  const checkIn = addDays(bookingWindowStart, 9) // day 10 of next month
  const checkOut = addDays(bookingWindowStart, 11) // day 12 → 2 nights

  await page.route("**/api/busy-dates**", (route) =>
    route.fulfill({ json: { dates: [] } }),
  )

  let checkoutBody: Record<string, unknown> | null = null
  await page.route("**/api/checkout", async (route) => {
    checkoutBody = route.request().postDataJSON()
    // Redirect back to the room page (the home page would drop the query)
    await route.fulfill({ json: { url: `${page.url()}?e2e-checkout=ok` } })
  })

  await page.goto("/")
  await expect(page).toHaveURL(/\/rooms\/\d+$/)

  // Select the range in the first visible month (always fully bookable,
  // see the booking window in playwright.config.ts)
  const firstMonth = page.getByRole("grid").first()
  await firstMonth.locator("button", { hasText: /^10$/ }).click()
  await firstMonth.locator("button", { hasText: /^12$/ }).click()

  await expect(page.getByText("(2 nuits)")).toBeVisible()
  await page.getByRole("button", { name: "Voir le tarif" }).click()

  const dialog = page.getByRole("dialog")
  await expect(dialog.getByText("Confirmer la réservation")).toBeVisible()
  await expect(dialog.locator("p", { hasText: "Prix :" })).toContainText("€")

  await dialog.getByLabel("Nom complet *").fill("Jean Testeur")
  await dialog.getByLabel("Email *").fill("jean@example.com")
  await dialog.getByLabel("Téléphone *").fill("+33612345678")
  await dialog.getByRole("button", { name: "Réserver" }).click()

  // BookingDialog redirects the browser to the (mocked) checkout URL
  await page.waitForURL(/e2e-checkout=ok/)

  expect(checkoutBody).toMatchObject({
    roomId: expect.any(Number),
    roomName: "Tante Aimée",
    adultsCount: 2,
    childrenCount: 0,
    fromDate: format(checkIn, "yyyy-MM-dd"),
    toDate: format(checkOut, "yyyy-MM-dd"),
    fullName: "Jean Testeur",
    email: "jean@example.com",
    phone: "+33612345678",
    sessionId: expect.any(String),
  })
})
