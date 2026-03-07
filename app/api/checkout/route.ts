import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getDb } from "@/lib/db"
import { createCheckoutSession } from "@/lib/checkout"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

export async function POST(request: NextRequest) {
  const body = await request.json()
  const origin = request.nextUrl.origin
  const sql = getDb()

  const result = await createCheckoutSession(stripe, sql, {
    ...body,
    origin,
  })

  return NextResponse.json(result)
}