import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { stripe, calendar } from "@/lib/deps"
import { createCheckoutSession, DatesUnavailableError, DatesOutsideWindowError } from "@/lib/checkout"

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
    if (err instanceof DatesOutsideWindowError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }
}