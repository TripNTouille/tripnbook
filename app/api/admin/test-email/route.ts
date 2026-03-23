import { auth } from "@/lib/auth"
import { email } from "@/lib/deps"
import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const toEmail = body?.email
  if (!toEmail || typeof toEmail !== "string") {
    return NextResponse.json({ error: "Missing email" }, { status: 400 })
  }

  await email.sendConfirmation({
    guestEmail: toEmail,
    guestName: "Test Email",
    roomName: "Jules Verne",
    adultsCount: 2,
    childrenCount: 0,
    from: "1 janv. 2026",
    to: "4 janv. 2026",
    nightCount: 3,
    totalPrice: 225,
  })

  return NextResponse.json({ ok: true })
}
