"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(false)

    const form = e.currentTarget
    const password = (form.elements.namedItem("password") as HTMLInputElement).value

    const result = await signIn("credentials", { password, redirect: false })

    if (result?.error) {
      setError(true)
      setPending(false)
    } else {
      router.push("/admin")
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold">Administration</h1>

        <input
          type="password"
          name="password"
          placeholder="Mot de passe"
          required
          className="border rounded px-3 py-2"
        />

        {error && (
          <p className="text-red-600 text-sm">Mot de passe incorrect.</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {pending ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </main>
  )
}