import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { Resend } from "resend"
import { getDb } from "@/lib/db"

import { areDatesFree, createHoldEvent, confirmHoldEvent, deleteHoldEvent } from "@/lib/calendar"
import { sendBookingConfirmation } from "@/lib/email"
import { handleWebhookEvent, type CalendarDeps, type EmailDeps } from "@/lib/checkout"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

const resend = new Resend(process.env.RESEND_API_KEY!)

const calendar: CalendarDeps = {
  areDatesFree,
  createHoldEvent,
  confirmHoldEvent,
  deleteHoldEvent,
}

const email: EmailDeps = {
  sendConfirmation: (data) => sendBookingConfirmation(resend, data),
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
    email,
    rawBody,
    signature,
    webhookSecret,
  )
  return NextResponse.json(body, { status })
}