import { auth } from "@/lib/auth"
import { stripe } from "@/lib/deps"
import { NextResponse } from "next/server"

export type StripeTestResult = {
  createSession: { ok: boolean; sessionId?: string; error?: string }
  expireSession: { ok: boolean; error?: string }
}

export async function POST() {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result: StripeTestResult = {
    createSession: { ok: false },
    expireSession: { ok: false },
  }

  let sessionId: string
  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "eur",
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: 22500,
            product_data: { name: "Test — Jules Verne · 3 nuits" },
          },
          quantity: 1,
        },
      ],
      // Shortest allowed expiry is 30 minutes — we expire it manually right after
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      success_url: "https://example.com",
      cancel_url: "https://example.com",
    })
    sessionId = checkoutSession.id
    result.createSession = { ok: true, sessionId }
  } catch (err) {
    result.createSession = { ok: false, error: String(err) }
    return NextResponse.json(result)
  }

  try {
    await stripe.checkout.sessions.expire(sessionId)
    result.expireSession = { ok: true }
  } catch (err) {
    result.expireSession = { ok: false, error: String(err) }
  }

  return NextResponse.json(result)
}