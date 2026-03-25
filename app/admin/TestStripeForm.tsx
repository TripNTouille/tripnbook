"use client"

import { useState } from "react"
import type { StripeTestResult } from "@/app/api/admin/test-stripe/route"

type StepStatus = "idle" | "pending" | "success" | "error"

type Steps = {
  createSession: StepStatus
  expireSession: StepStatus
}

const STEPS: { key: keyof Steps; label: string }[] = [
  { key: "createSession", label: "Créer la session" },
  { key: "expireSession", label: "Expirer la session" },
]

const stepColors: Record<StepStatus, string> = {
  idle:    "text-gray-400",
  pending: "text-blue-500",
  success: "text-green-600",
  error:   "text-red-600",
}

const stepIcons: Record<StepStatus, string> = {
  idle:    "○",
  pending: "◌",
  success: "✓",
  error:   "✕",
}

export default function TestStripeForm() {
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Steps>({ createSession: "idle", expireSession: "idle" })
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof Steps, string>>>({})

  async function handleClick() {
    setRunning(true)
    setSessionId(null)
    setErrors({})
    setSteps({ createSession: "pending", expireSession: "idle" })

    const res = await fetch("/api/admin/test-stripe", { method: "POST" })
    const body: StripeTestResult = await res.json()

    const newErrors: Partial<Record<keyof Steps, string>> = {}

    if (body.createSession.ok) {
      setSessionId(body.createSession.sessionId ?? null)
      setSteps({ createSession: "success", expireSession: "pending" })
    } else {
      newErrors.createSession = body.createSession.error
      setSteps({ createSession: "error", expireSession: "idle" })
      setErrors(newErrors)
      setRunning(false)
      return
    }

    if (body.expireSession.ok) {
      setSteps({ createSession: "success", expireSession: "success" })
    } else {
      newErrors.expireSession = body.expireSession.error
      setSteps({ createSession: "success", expireSession: "error" })
    }

    setErrors(newErrors)
    setRunning(false)
  }

  const allIdle = steps.createSession === "idle"

  return (
    <section className="border rounded-lg p-6 max-w-md">
      <h2 className="text-lg font-medium mb-1">Test Stripe</h2>
      <p className="text-sm text-gray-500 mb-4">
        Crée une session de paiement test et l&apos;expire immédiatement.
      </p>

      <button
        onClick={handleClick}
        disabled={running}
        className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50 mb-4"
      >
        {running ? "En cours…" : "Lancer le test"}
      </button>

      {!allIdle && (
        <ul className="space-y-2">
          {STEPS.map(({ key, label }) => {
            const status = steps[key]
            return (
              <li key={key} className={`flex flex-col gap-0.5 text-sm ${stepColors[status]}`}>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{stepIcons[status]}</span>
                  {label}
                  {key === "createSession" && status === "success" && sessionId && (
                    <span className="relative group cursor-default">
                      <span className="text-gray-400 text-xs border border-gray-300 rounded-full px-1">id</span>
                      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs font-mono rounded px-2 py-1 whitespace-nowrap z-10">
                        {sessionId}
                      </span>
                    </span>
                  )}
                </span>
                {errors[key] && (
                  <span className="ml-6 text-xs text-red-500">{errors[key]}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}