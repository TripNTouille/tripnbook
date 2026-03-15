import { NextRequest, NextResponse } from "next/server"
import { getDb } from "@/lib/db"
import { stripe, calendar, email } from "@/lib/deps"
import { handleGetSession } from "@/lib/checkout"

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id")
  const sql = getDb()

  const { status, body } = await handleGetSession(stripe, sql, calendar, email, sessionId)
  return NextResponse.json(body, { status })
}