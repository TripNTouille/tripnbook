import { google, calendar_v3 } from "googleapis"
import { addDays, addMonths, startOfDay, startOfMonth, format } from "date-fns"
import { getRoom } from "./rooms"
import { getDb } from "./db"
import { getHoldInfo } from "./booking-logs"

const SCOPES = ["https://www.googleapis.com/auth/calendar"]

function getAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const privateKey = process.env.GOOGLE_PRIVATE_KEY

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY environment variable")
  }

  return new google.auth.JWT({
    email: clientEmail,
    // Vercel stores \n as literal characters in env vars — restore them
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: SCOPES,
  })
}

function getCalendarClient(): calendar_v3.Calendar {
  return google.calendar({ version: "v3", auth: getAuth() })
}

/**
 * Queries Google Calendar for busy slots in monthly chunks.
 * The Google FreeBusy API limits queries to ~2 months, so we split the range automatically.
 */
export async function fetchBusySlotsFromGoogle(
  calendarId: string,
  from: Date,
  to: Date,
): Promise<{ start: string; end: string }[]> {
  const calendar = getCalendarClient()

  const chunks: { start: Date; end: Date }[] = []
  let chunkStart = from
  while (chunkStart < to) {
    const chunkEnd = startOfMonth(addMonths(chunkStart, 1))
    chunks.push({ start: chunkStart, end: chunkEnd < to ? chunkEnd : to })
    chunkStart = chunkEnd
  }

  const responses = await Promise.all(
    chunks.map((chunk) =>
      calendar.freebusy.query({
        requestBody: {
          timeMin: chunk.start.toISOString(),
          timeMax: chunk.end.toISOString(),
          items: [{ id: calendarId }],
        },
      })
    ),
  )

  return responses.flatMap(
    (r) => r.data.calendars?.[calendarId]?.busy ?? []
  ) as { start: string; end: string }[]
}

/**
 * Converts busy slots (time ranges) into individual booked night dates.
 *
 * A booked night is represented in Google Calendar as an event from 4pm to 11am the next day.
 * A multi-night booking is a single event (e.g. Jan 10 4pm → Jan 13 11am = 3 nights).
 *
 * For each busy interval, every day from the start date up to (but not including) the end date
 * is a booked night. The end date (checkout day) remains available for new check-ins.
 */
function slotsToNights(slots: { start: string; end: string }[]): Date[] {
  const nights: Date[] = []
  for (const slot of slots) {
    if (!slot.start || !slot.end) continue
    let day = startOfDay(new Date(slot.start))
    const end = startOfDay(new Date(slot.end))
    while (day < end) {
      nights.push(day)
      day = addDays(day, 1)
    }
  }
  return nights
}

/**
 * Returns booked nights for the given room, excluding the current user's pending hold.
 */
export async function getBusyDates(
  roomId: number,
  from: Date,
  to: Date,
  sessionId: string,
): Promise<Date[]> {
  const room = await getRoom(roomId)
  if (!room?.google_calendar_id) return []

  const slots = await fetchBusySlotsFromGoogle(room.google_calendar_id, from, to)
  const nights = slotsToNights(slots)

  const { dates: holdNights } = await getHoldInfo(getDb(), roomId, sessionId)
  return nights.filter((night) => !holdNights.has(night.toISOString()))
}

export type DatesAvailability = {
  hasBusyDates: boolean
  stripeSessionIdToExpire: string | null
}

/**
 * Checks whether all nights in a date range are free on the given room's calendar,
 * excluding the current user's own pending hold.
 *
 * Returns hasBusyDates so the caller knows whether to block the booking,
 * and stripeSessionIdToExpire so the caller can cancel the user's existing hold
 * before creating a new one.
 */
export async function checkDatesAvailability(
  roomId: number,
  checkIn: Date,
  checkOut: Date,
  sessionId: string,
): Promise<DatesAvailability> {
  const holdInfo = await getHoldInfo(getDb(), roomId, sessionId)

  const room = await getRoom(roomId)
  if (!room?.google_calendar_id) return { hasBusyDates: false, stripeSessionIdToExpire: holdInfo.stripeSessionId }

  const slots = await fetchBusySlotsFromGoogle(room.google_calendar_id, checkIn, checkOut)
  const nights = slotsToNights(slots)

  const confirmedNights = nights.filter((night) => !holdInfo.dates.has(night.toISOString()))
  return {
    hasBusyDates: confirmedNights.length > 0,
    stripeSessionIdToExpire: holdInfo.stripeSessionId,
  }
}

export type HoldEventInfo = {
  fullName: string
  email: string
  phone: string
  specialNeeds: string | null
  adultsCount: number
  childrenCount: number
}

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/payments"

/**
 * Creates a temporary "hold" event on the room's calendar while the guest completes payment.
 * Returns the created event ID so it can be cleaned up if payment is cancelled.
 *
 * The event spans from check-in day 16:00 to check-out day 11:00,
 * matching the convention used for actual bookings.
 */
export async function createHoldEvent(
  roomId: number,
  checkIn: Date,
  checkOut: Date,
  guest: HoldEventInfo,
): Promise<string> {
  const room = await getRoom(roomId)
  if (!room?.google_calendar_id) throw new Error(`Room ${roomId} has no calendar`)

  const calendar = getCalendarClient()
  const checkInLabel = format(checkIn, "yyyy-MM-dd")
  const checkOutLabel = format(checkOut, "yyyy-MM-dd")
  const createdAt = format(new Date(), "dd/MM/yyyy HH:mm")

  const totalGuests = guest.adultsCount + guest.childrenCount
  const guestLabel = `${totalGuests} pers. (${guest.adultsCount} ad.${guest.childrenCount > 0 ? `, ${guest.childrenCount} enf.` : ""})`

  const descriptionLines = [
    `Réservation via Trip'n Book — en attente de paiement`,
    ``,
    `Nom : ${guest.fullName}`,
    `Voyageurs : ${guestLabel}`,
    `Email : ${guest.email}`,
    `Téléphone : ${guest.phone}`,
    ...(guest.specialNeeds ? [`Demandes : ${guest.specialNeeds}`] : []),
    ``,
    `Créé le ${createdAt}`,
  ]

  const response = await calendar.events.insert({
    calendarId: room.google_calendar_id,
    requestBody: {
      summary: `⏳ ${guest.fullName} — Trip'n Book`,
      description: descriptionLines.join("\n"),
      start: { dateTime: `${checkInLabel}T16:00:00`, timeZone: "Europe/Paris" },
      end: { dateTime: `${checkOutLabel}T11:00:00`, timeZone: "Europe/Paris" },
    },
  })

  const eventId = response.data.id
  if (!eventId) throw new Error("Google Calendar did not return an event ID")

  return eventId
}

/**
 * Updates the hold event after successful payment:
 * removes the ⏳ pending marker and appends a Stripe payment link to the description.
 */
export async function confirmHoldEvent(
  roomId: number,
  eventId: string,
  paymentIntentId: string,
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room?.google_calendar_id) throw new Error(`Room ${roomId} has no calendar`)

  const calendar = getCalendarClient()
  const event = await calendar.events.get({ calendarId: room.google_calendar_id, eventId })
  const summary = (event.data.summary ?? "").replace("⏳ ", "")
  const description = (event.data.description ?? "")
    .replace("en attente de paiement", "payé")
    + `\nStripe : ${STRIPE_DASHBOARD_URL}/${paymentIntentId}`

  await calendar.events.patch({
    calendarId: room.google_calendar_id,
    eventId,
    requestBody: { summary, description },
  })
}

/**
 * Deletes a hold event (e.g. after payment cancellation or expiry).
 * Silently ignores "not found" errors — the event may have already been removed.
 */
export async function deleteHoldEvent(
  roomId: number,
  eventId: string,
): Promise<void> {
  const room = await getRoom(roomId)
  if (!room?.google_calendar_id) return

  const calendar = getCalendarClient()
  try {
    await calendar.events.delete({ calendarId: room.google_calendar_id, eventId })
  } catch (err: unknown) {
    const isNotFound = err instanceof Error && "code" in err && (err as { code: number }).code === 404
    if (!isNotFound) throw err
  }
}
