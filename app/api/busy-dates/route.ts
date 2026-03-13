import { NextRequest, NextResponse } from "next/server"
import { getBusyDates } from "@/lib/calendar"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const roomId = params.get("roomId")
  const from = params.get("from")
  const to = params.get("to")
  const sessionId = params.get("sessionId")

  if (!roomId || !from || !to || !sessionId) {
    return NextResponse.json(
      { error: "Missing roomId, from, to or sessionId parameter" },
      { status: 400 },
    )
  }

  const dates = await getBusyDates(Number(roomId), new Date(from), new Date(to))

  return NextResponse.json({
    dates: dates.map((d) => d.toISOString()),
  })
}