import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getDb } from "@/lib/db"
import { retrieveCheckoutSession } from "@/lib/checkout"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")

  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
  }

  try {
    const sql = getDb()
    const result = await retrieveCheckoutSession(stripe, sql, sessionId)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }
}