"use client"

import * as Sentry from "@sentry/nextjs"
import { useState, useEffect } from "react"

type Status = "idle" | "pending" | "success" | "error"

class SentryExampleFrontendError extends Error {
  constructor() {
    super("This error is raised on the frontend of the admin Sentry test.")
    this.name = "SentryExampleFrontendError"
  }
}

export default function TestSentryForm() {
  const [status, setStatus] = useState<Status>("idle")
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  useEffect(() => {
    Sentry.diagnoseSdkConnectivity().then((result) => {
      setIsConnected(result !== "sentry-unreachable")
    })
  }, [])

  async function handleClick() {
    setStatus("pending")

    await Sentry.startSpan({ name: "Admin Sentry Test", op: "test" }, async () => {
      const res = await fetch("/api/sentry-example-api")
      if (!res.ok) {
        setStatus("success")
      }
    })

    throw new SentryExampleFrontendError()
  }

  return (
    <section className="border rounded-lg p-6">
      <h2 className="text-lg font-medium mb-1">Test Sentry</h2>
      <p className="text-sm text-gray-500 mb-4">
        Envoie une erreur frontend et backend à Sentry.
      </p>

      {isConnected === false && (
        <p className="text-sm text-red-600 mb-4">
          Sentry semble inaccessible. Vérifiez votre bloqueur de publicités.
        </p>
      )}

      <button
        onClick={handleClick}
        disabled={status === "pending" || isConnected === false}
        className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
      >
        {status === "pending" ? "Envoi…" : "Lancer le test"}
      </button>

      {status === "success" && (
        <p className="mt-3 text-sm text-green-600">Erreur envoyée à Sentry.</p>
      )}
    </section>
  )
}