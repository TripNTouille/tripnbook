import type Stripe from "stripe"

type JsonResponse = {
  status: number
  body: Record<string, unknown>
}

/**
 * A SQL tagged-template executor compatible with both Neon and PGlite adapters.
 * Accepts a template and returns an array of row objects.
 */
export type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>

export type CheckoutInput = {
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
  origin: string
}

export type CheckoutResult = {
  url: string | null
}

export type SessionResult = {
  paymentStatus: string
  customerEmail: string | null
  amountTotal: number | null
  metadata: Record<string, string>
}

export async function createCheckoutSession(
  stripe: Stripe,
  sql: SqlExecutor,
  input: CheckoutInput,
): Promise<CheckoutResult> {
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
    origin,
  } = input

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

  await sql`
    INSERT INTO booking_logs
      (room_name, adults_count, children_count, check_in, check_out,
       night_count, total_price, email, phone, special_needs, stripe_session_id)
    VALUES
      (${roomName}, ${adultsCount}, ${childrenCount}, ${from}, ${to},
       ${nightCount}, ${totalPrice}, ${email}, ${phone}, ${specialNeeds || null}, ${session.id})
  `

  return { url: session.url }
}

export async function retrieveCheckoutSession(
  stripe: Stripe,
  sql: SqlExecutor,
  sessionId: string,
): Promise<SessionResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  const status = session.payment_status === "paid" ? "paid" : "cancelled"
  await sql`
    UPDATE booking_logs
    SET status = ${status}
    WHERE stripe_session_id = ${sessionId} AND status = 'pending'
  `

  return {
    paymentStatus: session.payment_status,
    customerEmail: session.customer_email,
    amountTotal: session.amount_total,
    metadata: (session.metadata ?? {}) as Record<string, string>,
  }
}

export async function handleGetSession(
  stripe: Stripe,
  sql: SqlExecutor,
  sessionId: string | null,
): Promise<JsonResponse> {
  if (!sessionId) {
    return { status: 400, body: { error: "Missing session_id" } }
  }

  try {
    const result = await retrieveCheckoutSession(stripe, sql, sessionId)
    return { status: 200, body: result as unknown as Record<string, unknown> }
  } catch {
    return { status: 404, body: { error: "Session not found" } }
  }
}