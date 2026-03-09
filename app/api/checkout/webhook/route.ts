import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getDb } from "@/lib/db"
import { getRoom } from "@/lib/rooms"
import { areDatesFree, createHoldEvent, confirmHoldEvent, deleteHoldEvent } from "@/lib/google-calendar"
import { handleWebhookEvent, type CalendarDeps } from "@/lib/checkout"

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
  const rawBody = Buffer.from(await request.arrayBuffer())
  const signature = request.headers.get("stripe-signature") ?? ""
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ""
  const sql = getDb()

  const { status, body } = await handleWebhookEvent(
    stripe,
    sql,
    calendar,
    rawBody,
    signature,
    webhookSecret,
  )
  return NextResponse.json(body, { status })
}