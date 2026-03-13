import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getDb } from "@/lib/db"
import { getRoom } from "@/lib/rooms"
import { areDatesFree, createHoldEvent, confirmHoldEvent, deleteHoldEvent } from "@/lib/calendar"
import { createCheckoutSession, DatesUnavailableError, type CalendarDeps } from "@/lib/checkout"

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
  confirmHoldEvent,
  deleteHoldEvent,
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const origin = request.nextUrl.origin
  const sql = getDb()

  try {
    const result = await createCheckoutSession(stripe, sql, calendar, {
      ...body,
      origin,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof DatesUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    throw err
  }
}