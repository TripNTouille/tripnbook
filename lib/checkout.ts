import type Stripe from "stripe"
import type { HoldEventInfo } from "./google-calendar"

// Stripe event types handled by the webhook
const HANDLED_EVENTS = ["checkout.session.completed", "checkout.session.expired"] as const

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

/**
 * Calendar operations needed by checkout, injected for testability.
 */
export type CalendarDeps = {
  getCalendarId: (roomId: number) => Promise<string | null>
  areDatesFree: (calendarId: string, checkIn: Date, checkOut: Date) => Promise<boolean>
  createHoldEvent: (calendarId: string, checkIn: Date, checkOut: Date, guest: HoldEventInfo) => Promise<string>
  confirmHoldEvent: (calendarId: string, eventId: string, paymentIntentId: string) => Promise<void>
  deleteHoldEvent: (calendarId: string, eventId: string) => Promise<void>
}

export type CheckoutInput = {
  roomId: number
  roomName: string
  adultsCount: number
  childrenCount: number
  from: string
  to: string
  fromDate: string // ISO date for calendar operations
  toDate: string   // ISO date for calendar operations
  nightCount: number
  totalPrice: number
  fullName: string
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
  calendar: CalendarDeps,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const {
    roomId,
    roomName,
    adultsCount,
    childrenCount,
    from,
    to,
    fromDate,
    toDate,
    nightCount,
    totalPrice,
    fullName,
    email,
    phone,
    specialNeeds,
    returnUrl,
    origin,
  } = input

  const checkIn = new Date(fromDate)
  const checkOut = new Date(toDate)

  // Block the dates on Google Calendar before creating the Stripe session
  const calendarId = await calendar.getCalendarId(roomId)
  let holdEventId: string | null = null

  if (calendarId) {
    const free = await calendar.areDatesFree(calendarId, checkIn, checkOut)
    if (!free) {
      throw new DatesUnavailableError()
    }
    holdEventId = await calendar.createHoldEvent(calendarId, checkIn, checkOut, {
      fullName,
      email,
      phone,
      specialNeeds,
    })
  }

  const totalGuests = adultsCount + childrenCount
  const guestLabel = `${totalGuests} pers. (${adultsCount} ad.${childrenCount > 0 ? `, ${childrenCount} enf.` : ""})`

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
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
        fullName,
        adultsCount: String(adultsCount),
        childrenCount: String(childrenCount),
        from,
        to,
        nightCount: String(nightCount),
        phone,
        specialNeeds,
        ...(calendarId && { calendarId }),
        ...(holdEventId && { holdEventId }),
      },
      success_url: `${origin}${returnUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}${returnUrl}?checkout=cancelled&session_id={CHECKOUT_SESSION_ID}`,
    })
  } catch (err) {
    // Clean up the hold event if Stripe session creation fails
    if (calendarId && holdEventId) {
      await calendar.deleteHoldEvent(calendarId, holdEventId)
    }
    throw err
  }

  await sql`
    INSERT INTO booking_logs
      (room_name, full_name, adults_count, children_count, check_in, check_out,
       night_count, total_price, email, phone, special_needs, stripe_session_id)
    VALUES
      (${roomName}, ${fullName}, ${adultsCount}, ${childrenCount}, ${from}, ${to},
       ${nightCount}, ${totalPrice}, ${email}, ${phone}, ${specialNeeds || null}, ${session.id})
  `

  return { url: session.url }
}

export async function retrieveCheckoutSession(
  stripe: Stripe,
  sql: SqlExecutor,
  calendar: CalendarDeps,
  sessionId: string,
): Promise<SessionResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  await fulfillSession(sql, calendar, session)

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
  calendar: CalendarDeps,
  sessionId: string | null,
): Promise<JsonResponse> {
  if (!sessionId) {
    return { status: 400, body: { error: "Missing session_id" } }
  }

  try {
    const result = await retrieveCheckoutSession(stripe, sql, calendar, sessionId)
    return { status: 200, body: result as unknown as Record<string, unknown> }
  } catch {
    return { status: 404, body: { error: "Session not found" } }
  }
}

export class DatesUnavailableError extends Error {
  constructor() {
    super("Les dates sélectionnées ne sont plus disponibles")
    this.name = "DatesUnavailableError"
  }
}

/**
 * Fulfils a booking from a pre-parsed Stripe session (used by the webhook handler).
 *
 * Unlike retrieveCheckoutSession, this does not re-fetch the session from Stripe —
 * the webhook already delivers the full session object, so we use it directly.
 *
 * Idempotent: booking_logs rows are only updated when status = 'pending',
 * so replayed webhook events are safe.
 */
export async function fulfillSession(
  sql: SqlExecutor,
  calendar: CalendarDeps,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const isPaid = session.payment_status === "paid"
  const newStatus = isPaid ? "paid" : "cancelled"

  await sql`
    UPDATE booking_logs
    SET status = ${newStatus}
    WHERE stripe_session_id = ${session.id} AND status = 'pending'
  `

  const calendarId = session.metadata?.calendarId
  const holdEventId = session.metadata?.holdEventId

  if (calendarId && holdEventId) {
    if (isPaid) {
      const paymentIntent = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? session.id
      await calendar.confirmHoldEvent(calendarId, holdEventId, paymentIntent)
    } else {
      await calendar.deleteHoldEvent(calendarId, holdEventId)
    }
  }
}

/**
 * Handles an incoming Stripe webhook request.
 *
 * Verifies the signature, then fulfils the booking for handled event types.
 * Returns a JsonResponse so the route handler stays thin and the logic is testable.
 */
export async function handleWebhookEvent(
  stripe: Stripe,
  sql: SqlExecutor,
  calendar: CalendarDeps,
  rawBody: Buffer,
  signature: string,
  webhookSecret: string,
): Promise<JsonResponse> {
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch {
    // Invalid signature — reject immediately
    return { status: 400, body: { error: "Invalid webhook signature" } }
  }

  const isHandled = (HANDLED_EVENTS as readonly string[]).includes(event.type)
  if (!isHandled) {
    // Acknowledge unhandled event types so Stripe doesn't retry them
    return { status: 200, body: { received: true } }
  }

  const session = event.data.object as Stripe.Checkout.Session
  await fulfillSession(sql, calendar, session)

  return { status: 200, body: { received: true } }
}
