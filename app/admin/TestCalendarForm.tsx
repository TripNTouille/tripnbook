"use client"

import { useState, useEffect } from "react"
import type { CalendarTestResult } from "@/app/api/admin/test-calendar/route"

type Room = { id: number; name: string }
type StepStatus = "idle" | "pending" | "success" | "error"

type WindowKey = "tomorrow" | "nextWeek" | "nextMonth"

type Steps = Record<WindowKey, StepStatus>

const WINDOWS: { key: WindowKey; label: string }[] = [
  { key: "tomorrow",  label: "Demain" },
  { key: "nextWeek",  label: "7 prochains jours" },
  { key: "nextMonth", label: "30 prochains jours" },
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

function toISODate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function getWindows(): Record<WindowKey, { checkIn: string; checkOut: string }> {
  const today = new Date()

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  const nextWeek = new Date(today)
  nextWeek.setDate(today.getDate() + 7)

  const nextMonth = new Date(today)
  nextMonth.setDate(today.getDate() + 30)

  return {
    tomorrow:  { checkIn: toISODate(tomorrow),  checkOut: toISODate(nextWeek) },
    nextWeek:  { checkIn: toISODate(today),      checkOut: toISODate(nextWeek) },
    nextMonth: { checkIn: toISODate(today),      checkOut: toISODate(nextMonth) },
  }
}

const IDLE_STEPS: Steps = { tomorrow: "idle", nextWeek: "idle", nextMonth: "idle" }

export default function TestCalendarForm() {
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState<Steps>(IDLE_STEPS)
  const [errors, setErrors] = useState<Partial<Record<WindowKey, string>>>({})
  const [busySlots, setBusySlots] = useState<Partial<Record<WindowKey, number>>>({})

  useEffect(() => {
    fetch("/api/admin/test-calendar")
      .then((r) => r.json())
      .then((data: Room[]) => {
        setRooms(data)
        if (data.length > 0) setRoomId(data[0].id)
      })
      .catch(() => {})
  }, [])

  async function handleClick() {
    if (!roomId) return

    setRunning(true)
    setSteps(IDLE_STEPS)
    setErrors({})
    setBusySlots({})

    const windows = getWindows()
    const newErrors: Partial<Record<WindowKey, string>> = {}
    const newBusySlots: Partial<Record<WindowKey, number>> = {}
    const newSteps: Steps = { ...IDLE_STEPS }

    for (const { key } of WINDOWS) {
      newSteps[key] = "pending"
      setSteps({ ...newSteps })

      const { checkIn, checkOut } = windows[key]
      const res = await fetch("/api/admin/test-calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, checkIn, checkOut }),
      })

      const body: CalendarTestResult = await res.json()

      if (!body.auth.ok) {
        newSteps[key] = "error"
        newErrors[key] = body.auth.error
        // Auth failure will affect all windows — no point continuing
        setSteps({ ...newSteps })
        setErrors({ ...newErrors })
        setRunning(false)
        return
      }

      if (body.freeBusy.ok) {
        newSteps[key] = "success"
        newBusySlots[key] = body.freeBusy.busySlots ?? 0
      } else {
        newSteps[key] = "error"
        newErrors[key] = body.freeBusy.error
      }

      setSteps({ ...newSteps })
      setBusySlots({ ...newBusySlots })
      setErrors({ ...newErrors })
    }

    setRunning(false)
  }

  const allIdle = WINDOWS.every(({ key }) => steps[key] === "idle")

  return (
    <section className="border rounded-lg p-6">
      <h2 className="text-lg font-medium mb-1">Test Calendrier</h2>
      <p className="text-sm text-gray-500 mb-4">
        Vérifie la connexion Google Calendar et la disponibilité sur plusieurs périodes.
      </p>

      <div className="flex gap-2 mb-4">
        <select
          value={roomId ?? ""}
          onChange={(e) => setRoomId(Number(e.target.value))}
          className="border rounded px-3 py-2 text-sm flex-1"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        <button
          onClick={handleClick}
          disabled={running || !roomId}
          className="bg-black text-white rounded px-4 py-2 text-sm disabled:opacity-50 whitespace-nowrap"
        >
          {running ? "En cours…" : "Lancer le test"}
        </button>
      </div>

      {!allIdle && (
        <ul className="space-y-2">
          {WINDOWS.map(({ key, label }) => {
            const status = steps[key]
            const slots = busySlots[key]
            return (
              <li key={key} className={`flex flex-col gap-0.5 text-sm ${stepColors[status]}`}>
                <span className="flex items-center gap-2">
                  <span className="font-mono">{stepIcons[status]}</span>
                  {label}
                  {status === "success" && slots !== undefined && (
                    <span className="text-gray-500 text-xs">
                      {slots === 0
                        ? "Disponible"
                        : `${slots} créneau${slots > 1 ? "x" : ""} occupé${slots > 1 ? "s" : ""}`}
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