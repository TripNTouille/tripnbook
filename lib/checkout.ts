import { parseISO, format, differenceInDays } from "date-fns"
import { fr } from "date-fns/locale"
import type Stripe from "stripe"
import type { HoldEventInfo } from "./calendar"
import type { BookingConfirmationData } from "./email"
import { insertBookingLog, updateBookingLogStatus } from "./booking-logs"
import { calculatePrice } from "./pricing"
import { getBookingWindow } from "./booking-window"
import type { SqlExecutor } from "./db"

// Stripe event types handled by the webhook
const HANDLED_EVENTS = ["checkout.session.completed", "checkout.session.expired"] as const

type JsonResponse = {
  status: number
  body: Record<string, unknown>
}

/**
 * Calendar operations needed by checkout, injected for testability.
 */
export type CalendarDeps = {
  checkDatesAvailability: (roomId: number, checkIn: Date, checkOut: Date, sessionId: string) => Promise<{ hasBusyDates: boolean; stripeSessionIdToExpire: string | null }>
  createHoldEvent: (roomId: number, checkIn: Date, checkOut: Date, guest: HoldEventInfo) => Promise<string>
  confirmHoldEvent: (roomId: number, eventId: string, paymentIntentId: string) => Promise<void>
  deleteHoldEvent: (roomId: number, eventId: string) => Promise<void>
}

export type EmailDeps = {
  sendConfirmation: (data: BookingConfirmationData) => Promise<void>
}

export type CheckoutInput = {
  roomId: number
  roomName: string
  adultsCount: number
  childrenCount: number
  fromDate: string
  toDate: string
  fullName: string
  email: string
  phone: string
  specialNeeds: string | null
  origin: string
  sessionId: string
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
    fromDate,
    toDate,
    fullName,
    email,
    phone,
    specialNeeds,
    origin,
    sessionId,
  } = input

  // parseISO("2025-04-17") → local midnight, safe across timezones.
  // new Date("2025-04-17") → UTC midnight, which shifts the date on servers
  // not in UTC (e.g. a Paris browser sending dates to a UTC Vercel server).
  const checkIn = parseISO(fromDate)
  const checkOut = parseISO(toDate)
  const fromLabel = format(checkIn, "d MMM yyyy", { locale: fr })
  const toLabel = format(checkOut, "d MMM yyyy", { locale: fr })
  const nightCount = differenceInDays(checkOut, checkIn)
  const { totalPrice } = calculatePrice({ nightCount, adultsCount, childrenCount })

  // Block the dates on Google Calendar before creating the Stripe session
  let holdEventId: string | null = null

  const bookingWindow = getBookingWindow()
  const isOutsideWindow = checkIn < bookingWindow.from || checkOut > bookingWindow.to
  if (isOutsideWindow) {
    throw new DatesOutsideWindowError()
  }

  const { hasBusyDates, stripeSessionIdToExpire } = await calendar.checkDatesAvailability(roomId, checkIn, checkOut, sessionId)
  if (hasBusyDates) {
    throw new DatesUnavailableError()
  }

  if (stripeSessionIdToExpire) {
    // Expire the previous hold session before creating a new one.
    // If this fails, abort — we don't want two concurrent holds for the same user.
    await stripe.checkout.sessions.expire(stripeSessionIdToExpire)
  }
  holdEventId = await calendar.createHoldEvent(roomId, checkIn, checkOut, {
    fullName,
    email,
    phone,
    specialNeeds,
    adultsCount,
    childrenCount,
  })

  const totalGuests = adultsCount + childrenCount
  const guestLabel = `${totalGuests} pers. (${adultsCount} ad.${childrenCount > 0 ? `, ${childrenCount} enf.` : ""})`

  // Expiry: 30 minutes from now (used for both Stripe session and booking log)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  const expiresAtTimestamp = Math.floor(expiresAt.getTime() / 1000)

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      expires_at: expiresAtTimestamp,
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: totalPrice * 100,
            product_data: {
              name: `${roomName} — ${nightCount} ${nightCount > 1 ? "nuits" : "nuit"}`,
              description: `${guestLabel} · du ${fromLabel} au ${toLabel} · Petit-déjeuner inclus`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        roomId: String(roomId),
        roomName,
        fullName,
        adultsCount: String(adultsCount),
        childrenCount: String(childrenCount),
        fromDate,
        toDate,
        nightCount: String(nightCount),
        phone,
        specialNeeds,
        ...(holdEventId && { holdEventId }),
      },
      success_url: `${origin}/rooms/${roomId}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/rooms/${roomId}?checkout=cancelled&session_id={CHECKOUT_SESSION_ID}`,
    })
  } catch (err) {
    // Clean up the hold event if Stripe session creation fails
    if (holdEventId) {
      await calendar.deleteHoldEvent(roomId, holdEventId)
    }
    throw err
  }

  try {
    await insertBookingLog(sql, {
      roomId,
      roomName,
      fullName,
      adultsCount,
      childrenCount,
      checkIn: fromDate,
      checkOut: toDate,
      nightCount,
      totalPrice,
      email,
      phone,
      specialNeeds,
      stripeSessionId: session.id,
      expiresAt,
      sessionId,
    })
  } catch (err) {
    // The Stripe session exists but we can't log it — clean up the hold event
    // so the dates don't remain blocked, then re-throw so the caller gets a 500.
    if (holdEventId) {
      await calendar.deleteHoldEvent(roomId, holdEventId)
    }
    throw err
  }

  return { url: session.url }
}

export async function retrieveCheckoutSession(
  stripe: Stripe,
  sql: SqlExecutor,
  calendar: CalendarDeps,
  email: EmailDeps,
  sessionId: string,
): Promise<SessionResult> {
  const session = await stripe.checkout.sessions.retrieve(sessionId)

  await fulfillSession(sql, calendar, email, session)

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
  email: EmailDeps,
  sessionId: string | null,
): Promise<JsonResponse> {
  if (!sessionId) {
    return { status: 400, body: { error: "Missing session_id" } }
  }

  try {
    const result = await retrieveCheckoutSession(stripe, sql, calendar, email, sessionId)
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

export class DatesOutsideWindowError extends Error {
  constructor() {
    super("Les dates sélectionnées sont en dehors de la période de réservation")
    this.name = "DatesOutsideWindowError"
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
  email: EmailDeps,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const isPaid = session.payment_status === "paid"
  const newStatus = isPaid ? "paid" : "cancelled"

  const updatedRows = await updateBookingLogStatus(sql, session.id, newStatus as "paid" | "cancelled")

  const holdEventId = session.metadata?.holdEventId

  // Calendar and email errors are caught independently so that:
  // - a calendar failure doesn't prevent the confirmation email from being sent
  // - an email failure doesn't cause a 500 that would trigger Stripe retries
  // Both are logged for manual follow-up; the booking log is already updated above.
  if (holdEventId) {
    if (updatedRows.length === 0) {
      // Either a replayed event (already processed) or a missing booking log.
      // In both cases skip the calendar operation — on replay it was already done,
      // on a missing log we have no trustworthy roomId to act on.
      console.error(`fulfillSession: no booking log row found for Stripe session ${session.id} — skipping calendar operation`)
    } else {
      const roomId = updatedRows[0].room_id as number
      if (isPaid) {
        const paymentIntent = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id ?? session.id
        await calendar.confirmHoldEvent(roomId, holdEventId, paymentIntent)
          .catch((err) => console.error("[checkout] Failed to confirm hold event", err))
      } else {
        await calendar.deleteHoldEvent(roomId, holdEventId)
          .catch((err) => console.error("[checkout] Failed to delete hold event", err))
      }
    }
  }

  // Only send the email when this call actually transitioned the row from
  // 'pending' to 'paid' — guards against sending duplicates on replayed events.
  const wasJustPaid = isPaid && updatedRows.length > 0
  if (wasJustPaid) {
    const meta = session.metadata ?? {}
    await email.sendConfirmation({
      guestEmail: session.customer_email ?? "",
      guestName: meta.fullName ?? "",
      roomName: meta.roomName ?? "",
      adultsCount: Number(meta.adultsCount ?? 0),
      childrenCount: Number(meta.childrenCount ?? 0),
      from: meta.fromDate ? format(parseISO(meta.fromDate), "d MMM yyyy", { locale: fr }) : "",
      to: meta.toDate ? format(parseISO(meta.toDate), "d MMM yyyy", { locale: fr }) : "",
      nightCount: Number(meta.nightCount ?? 0),
      totalPrice: Math.round((session.amount_total ?? 0) / 100),
    }).catch((err) => console.error("[checkout] Failed to send confirmation email", err))
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
  email: EmailDeps,
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
  await fulfillSession(sql, calendar, email, session)

  return { status: 200, body: { received: true } }
}
