import { auth } from "@/lib/auth"
import { getDb } from "@/lib/db"
import type { BookingLog } from "@/lib/booking-logs"
import { NextRequest, NextResponse } from "next/server"

export type BookingLogsResponse = {
  logs: BookingLog[]
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const status = req.nextUrl.searchParams.get("status")
  const sql = getDb()

  const rows = status
    ? await sql`
        SELECT * FROM booking_logs
        WHERE status = ${status}
        ORDER BY created_at DESC
        LIMIT 50
      `
    : await sql`
        SELECT * FROM booking_logs
        ORDER BY created_at DESC
        LIMIT 50
      `

  return NextResponse.json({ logs: rows as BookingLog[] })
}