import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getDb } from "@/lib/db"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
})

type CheckoutBody = {
  roomName: string
  adultsCount: number
  childrenCount: number
  from: string
  to: string
  nightCount: number
  totalPrice: number
  email: string
  phone: string
  specialNeeds: string
  returnUrl: string
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CheckoutBody

  const {
    roomName,
    adultsCount,
    childrenCount,
    from,
    to,
    nightCount,
    totalPrice,
    email,
    phone,
    specialNeeds,
    returnUrl,
  } = body

  const origin = request.nextUrl.origin

  const totalGuests = adultsCount + childrenCount
  const guestLabel = `${totalGuests} pers. (${adultsCount} ad.${childrenCount > 0 ? `, ${childrenCount} enf.` : ""})`

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    line_items: [
      {
        price_data: {
          currency: "eur",
          unit_amount: totalPrice * 100,
          product_data: {
            name: `${roomName} — ${nightCount} ${nightCount > 1 ? "nuits" : "nuit"}`,
            description: `${guestLabel} · du ${from} au ${to} · Petit-déjeuner inclus`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      roomName,
      adultsCount: String(adultsCount),
      childrenCount: String(childrenCount),
      from,
      to,
      nightCount: String(nightCount),
      phone,
      specialNeeds,
    },
    success_url: `${origin}${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${returnUrl}?checkout=cancelled&session_id={CHECKOUT_SESSION_ID}`,
  })

  const sql = getDb()
  await sql`
    INSERT INTO booking_logs
      (room_name, adults_count, children_count, check_in, check_out,
       night_count, total_price, email, phone, special_needs, stripe_session_id)
    VALUES
      (${roomName}, ${adultsCount}, ${childrenCount}, ${from}, ${to},
       ${nightCount}, ${totalPrice}, ${email}, ${phone}, ${specialNeeds || null}, ${session.id})
  `

  return NextResponse.json({ url: session.url })
}