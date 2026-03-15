import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { stripe, calendar, email } from "@/lib/deps"
import { handleWebhookEvent } from "@/lib/checkout"

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