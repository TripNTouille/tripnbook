import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { Resend } from "resend"
import { getDb } from "@/lib/db"
import { getRoom } from "@/lib/rooms"
import { areDatesFree, createHoldEvent, confirmHoldEvent, deleteHoldEvent } from "@/lib/calendar"
import { sendBookingConfirmation } from "@/lib/email"
import { handleGetSession, type CalendarDeps, type EmailDeps } from "@/lib/checkout"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

const resend = new Resend(process.env.RESEND_API_KEY!)

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

const email: EmailDeps = {
  sendConfirmation: (data) => sendBookingConfirmation(resend, data),
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")
  const sql = getDb()

  const { status, body } = await handleGetSession(stripe, sql, calendar, email, sessionId)
  return NextResponse.json(body, { status })
}