// Use the real contact email only on production — everywhere else (local, preview)
// routes to a personal address so Resend behaviour can be tested safely.
const isProduction = process.env.VERCEL_ENV === "production"

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
