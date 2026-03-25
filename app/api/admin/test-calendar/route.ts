import { auth } from "@/lib/auth"
import { getRooms } from "@/lib/rooms"
import { fetchBusySlotsFromGoogle } from "@/lib/calendar"
import { parseISO } from "date-fns"
import { NextRequest, NextResponse } from "next/server"

export type CalendarTestResult = {
  auth: { ok: boolean; error?: string }
  freeBusy: { ok: boolean; busySlots?: number; error?: string }
}

export async function GET() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rooms = await getRooms()
  return NextResponse.json(rooms.map((r) => ({ id: r.id, name: r.name })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const { roomId, checkIn, checkOut } = body ?? {}

  if (!roomId || !checkIn || !checkOut) {
    return NextResponse.json({ error: "Missing roomId, checkIn or checkOut" }, { status: 400 })
  }

  const result: CalendarTestResult = {
    auth: { ok: false },
    freeBusy: { ok: false },
  }

  const rooms = await getRooms()
  const room = rooms.find((r) => r.id === roomId)
  if (!room?.google_calendar_id) {
    result.auth = { ok: false, error: `Room ${roomId} has no Google Calendar ID` }
    return NextResponse.json(result)
  }

  // We test auth implicitly — if the FreeBusy call succeeds, auth worked.
  // If it fails with an auth error, we surface it clearly.
  try {
    const slots = await fetchBusySlotsFromGoogle(
      room.google_calendar_id,
      parseISO(checkIn),
      parseISO(checkOut),
    )
    result.auth = { ok: true }
    result.freeBusy = { ok: true, busySlots: slots.length }
  } catch (err) {
    const message = String(err)
    const isAuthError = message.includes("401") || message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("invalid_grant")
    if (isAuthError) {
      result.auth = { ok: false, error: message }
    } else {
      result.auth = { ok: true }
      result.freeBusy = { ok: false, error: message }
    }
  }

  return NextResponse.json(result)
}