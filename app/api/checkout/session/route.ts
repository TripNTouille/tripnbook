import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getDb } from "@/lib/db"
import { getRoom } from "@/lib/rooms"
import { areDatesFree, createHoldEvent, deleteHoldEvent } from "@/lib/google-calendar"
import { handleGetSession, type CalendarDeps } from "@/lib/checkout"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

const calendar: CalendarDeps = {
  getCalendarId: async (roomId) => {
    const room = await getRoom(roomId)
    return room?.google_calendar_id ?? null
  },
  areDatesFree,
  createHoldEvent,
  deleteHoldEvent,
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")
  const sql = getDb()

  const { status, body } = await handleGetSession(stripe, sql, calendar, sessionId)
  return NextResponse.json(body, { status })
}