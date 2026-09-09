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
  const [frontendStatus, setFrontendStatus] = useState<Status>("idle")
  const [backendStatus, setBackendStatus] = useState<Status>("idle")
  const [isConnected, setIsConnected] = useState<boolean | null>(null)

  useEffect(() => {
    Sentry.diagnoseSdkConnectivity().then((result) => {
      setIsConnected(result !== "sentry-unreachable")
    })
  }, [])

  function handleFrontendClick() {
    setFrontendStatus("success")
    throw new SentryExampleFrontendError()
  }

  async function handleBackendClick() {
    setBackendStatus("pending")

    const res = await fetch("/api/admin/test-sentry", { method: "POST" })
    // The route throws on purpose: a 500 means the server error was raised.
    setBackendStatus(!res.ok ? "success" : "error")
  }

  return (
    <section className="border rounded-lg p-6">
      <h2 className="text-lg font-medium mb-1">Test Sentry</h2>
      <p className="text-sm text-gray-500 mb-4">
        Envoie une erreur frontend ou serveur à Sentry.
      </p>

      {isConnected === false && (
        <p className="text-sm text-red-600 mb-4">
          Sentry semble inaccessible. Vérifiez votre bloqueur de publicités.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleFrontendClick}
          disabled={isConnected === false}
          className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          Erreur frontend
        </button>

        <button
          onClick={handleBackendClick}
          disabled={backendStatus === "pending" || isConnected === false}
          className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        >
          {backendStatus === "pending" ? "Envoi…" : "Erreur serveur"}
        </button>
      </div>

      {frontendStatus === "success" && (
        <p className="mt-3 text-sm text-green-600">Erreur frontend envoyée à Sentry.</p>
      )}
      {backendStatus === "success" && (
        <p className="mt-3 text-sm text-green-600">Erreur serveur envoyée à Sentry.</p>
      )}
      {backendStatus === "error" && (
        <p className="mt-3 text-sm text-red-600">
          La route de test n&apos;a pas renvoyé d&apos;erreur.
        </p>
      )}
    </section>
  )
}
