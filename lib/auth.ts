import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        password: { label: "Mot de passe", type: "password" },
      },
      authorize(credentials) {
        const isValid = credentials.password === process.env.ADMIN_PASSWORD
        if (!isValid) return null

        // Auth.js requires a user object — we only have one admin
        return { id: "admin", name: "Admin" }
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
})