// Use real external services only on production — everywhere else (local, preview)
// we route to safe test values to avoid side effects.
const isProduction = process.env.VERCEL_ENV === "production"

// In non-production environments, use a dedicated test calendar instead of the
// real room calendars from the DB, so tests don't pollute guest-facing calendars.
export const DEV_CALENDAR_ID = "6b0cc1d7509e5eaf0ba2593034c4c369c74c612a83452a74265815fa2d979dbd@group.calendar.google.com"

export const siteConfig = {
  contactEmail: isProduction ? "contact@tripntouille.com" : process.env.DEV_EMAIL!,
  contactPhone: {
    display: "+33 6 30 43 85 87",
    href: "+33630438587",
  },
  address: [
    "859 route de Plainchassagne",
    "lieu-dit Plainchassagne",
    "Vendenesse-les-Charolles, 71120",
    "France",
  ],
  social: {
    facebook: "https://www.facebook.com/tripntouille",
    instagram: "https://www.instagram.com/tripntouille",
  },
} as const
