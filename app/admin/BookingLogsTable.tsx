"use client"

import { useState, useEffect } from "react"
import type { BookingLogsResponse } from "@/app/api/admin/booking-logs/route"
import type { BookingLog } from "@/lib/booking-logs"

type StatusFilter = "all" | "pending" | "paid" | "cancelled"

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "Tous" },
  { value: "pending",   label: "En attente" },
  { value: "paid",      label: "Payé" },
  { value: "cancelled", label: "Annulé" },
]

const statusBadge: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-800",
  paid:      "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-600",
}

const statusLabel: Record<string, string> = {
  pending:   "En attente",
  paid:      "Payé",
  cancelled: "Annulé",
}

function formatDate(value: Date | string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatDateTime(value: Date | string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function BookingLogsTable() {
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [logs, setLogs] = useState<BookingLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false

    async function fetchLogs() {
      setLoading(true)
      setError("")
      const url = filter === "all" ? "/api/admin/booking-logs" : `/api/admin/booking-logs?status=${filter}`
      const res = await fetch(url)
      if (cancelled) return
      if (res.ok) {
        const body: BookingLogsResponse = await res.json()
        setLogs(body.logs)
      } else {
        setError("Impossible de charger les réservations.")
      }
      setLoading(false)
    }

    fetchLogs()
    return () => { cancelled = true }
  }, [filter])

  return (
    <section className="border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Réservations</h2>
        <div className="flex gap-1">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1 rounded text-sm ${
                filter === value
                  ? "bg-black text-white"
                  : "text-gray-500 hover:text-black"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Chargement…</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-gray-400">Aucune réservation.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-gray-500 text-left">
                <th className="pb-2 pr-4 font-medium">Créé le</th>
                <th className="pb-2 pr-4 font-medium">Chambre</th>
                <th className="pb-2 pr-4 font-medium">Nom</th>
                <th className="pb-2 pr-4 font-medium">Arrivée</th>
                <th className="pb-2 pr-4 font-medium">Départ</th>
                <th className="pb-2 pr-4 font-medium">Montant</th>
                <th className="pb-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{log.room_name}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{log.full_name ?? "—"}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(log.check_in)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{formatDate(log.check_out)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">{log.total_price} €</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge[log.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabel[log.status] ?? log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}