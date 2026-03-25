"use client"

import { useState } from "react"

type Status = "idle" | "pending" | "success" | "error"

export default function TestEmailForm({ fromEmail }: { fromEmail: string }) {
  const [status, setStatus] = useState<Status>("idle")
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("pending")
    setErrorMessage("")

    const form = e.currentTarget
    const email = (form.elements.namedItem("email") as HTMLInputElement).value

    const res = await fetch("/api/admin/test-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })

    if (res.ok) {
      setStatus("success")
      form.reset()
    } else {
      const body = await res.json().catch(() => ({}))
      setErrorMessage(body.error ?? "Une erreur est survenue.")
      setStatus("error")
    }
  }

  return (
    <section className="border rounded-lg p-6">
      <h2 className="text-lg font-medium mb-1">Test d&apos;envoi d&apos;email</h2>
      <p className="text-sm text-gray-500 mb-1">
        Envoie un email de confirmation fictif via Resend.
      </p>
      <p className="text-sm text-gray-500 mb-4">
        Expéditeur : <span className="font-mono text-gray-700">{fromEmail}</span>
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          name="email"
          placeholder="adresse@exemple.com"
          required
          className="border rounded px-3 py-2 text-sm flex-1 min-w-0"
        />
        <button
          type="submit"
          disabled={status === "pending"}
          className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {status === "pending" ? "Envoi…" : "Envoyer"}
        </button>
      </form>

      {status === "success" && (
        <p className="mt-3 text-sm text-green-600">Email envoyé avec succès.</p>
      )}
      {status === "error" && (
        <p className="mt-3 text-sm text-red-600">{errorMessage}</p>
      )}
    </section>
  )
}