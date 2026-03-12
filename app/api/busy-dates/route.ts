import { NextRequest, NextResponse } from "next/server"
import { getRoom } from "@/lib/rooms"
import { getBusyDates } from "@/lib/google-calendar"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const roomId = params.get("roomId")
  const from = params.get("from")
  const to = params.get("to")
  const sessionId = params.get("sessionId")

  if (!roomId || !from || !to || !sessionId) {
    return NextResponse.json(
      { error: "Missing roomId, from, or to parameter" },
      { status: 400 },
    )
  }

  const room = await getRoom(Number(roomId))
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 })
  }

  if (!room.google_calendar_id) {
    return NextResponse.json({ dates: [] })
  }

  const dates = await getBusyDates(
    room.google_calendar_id,
    new Date(from),
    new Date(to),
    sessionId,
  )

  return NextResponse.json({
    dates: dates.map((d) => d.toISOString()),
  })
}
