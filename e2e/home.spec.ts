import { test, expect } from "@playwright/test"

// Smoke: server-rendered room page — DB query, redirect, RSC rendering,
// client hydration. Catches runtime breakage from next/react/neon bumps.
test("home redirects to the first room and renders the booking page", async ({ page }) => {
  const pageErrors: Error[] = []
  page.on("pageerror", (error) => pageErrors.push(error))

  await page.goto("/")

  await expect(page).toHaveURL(/\/rooms\/\d+$/)
  await expect(page.getByRole("heading", { name: "Tante Aimée" })).toBeVisible()

  // Room menu lists all seeded rooms
  for (const room of ["Tante Aimée", "Jules Verne", "Henriette", "Yukiko"]) {
    await expect(page.getByRole("link", { name: room })).toBeVisible()
  }

  // Booking form hydrated (guest selector label + calendar)
  await expect(page.getByText("Nombre d'hôtes :")).toBeVisible()
  await expect(page.getByRole("grid").first()).toBeVisible()

  expect(pageErrors, pageErrors.map((e) => e.message).join("\n")).toHaveLength(0)
})
