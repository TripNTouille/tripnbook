import { google, calendar_v3 } from "googleapis"
import { addDays, addMonths, startOfDay, startOfMonth, format } from "date-fns"

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
 * Returns an array of dates (midnight, local) that are booked nights for the given calendar.
 *
 * A booked night is represented in Google Calendar as an event from 4pm to 11am the next day.
 * A multi-night booking is a single event (e.g. Jan 10 4pm → Jan 13 11am = 3 nights).
 *
 * For each busy interval, every day from the start date up to (but not including) the end date
 * is a booked night. The end date (checkout day) remains available for new check-ins.
 *
 * The Google FreeBusy API limits queries to ~2 months, so we split the range
 * into monthly chunks automatically.
 */
export async function getBusyDates(
  calendarId: string,
  from: Date,
  to: Date,
  sessionId?: string,
): Promise<Date[]> {
  const calendar = getCalendarClient()

  // for later use
  if (!sessionId) throw new Error("sessionId undefined")

  // Split into monthly chunks to stay under Google's time range limit
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

  const bookedNights: Date[] = []
  for (const response of responses) {
    const busySlots = response.data.calendars?.[calendarId]?.busy ?? []

    for (const slot of busySlots) {
      if (!slot.start || !slot.end) continue

      const slotStart = startOfDay(new Date(slot.start))
      const slotEnd = startOfDay(new Date(slot.end))

      // Every day from start up to (not including) end is a booked night
      let day = slotStart
      while (day < slotEnd) {
        bookedNights.push(day)
        day = addDays(day, 1)
      }
    }
  }

  return bookedNights
}

/**
 * Checks whether all nights in a date range are free on the given calendar.
 */
export async function areDatesFree(
  calendarId: string,
  checkIn: Date,
  checkOut: Date,
): Promise<boolean> {
  const busyDates = await getBusyDates(calendarId, checkIn, checkOut)
  return busyDates.length === 0
}

export type HoldEventInfo = {
  fullName: string
  email: string
  phone: string
  specialNeeds: string
}

const STRIPE_DASHBOARD_URL = "https://dashboard.stripe.com/payments"

/**
 * Creates a temporary "hold" event on the calendar while the guest completes payment.
 * Returns the created event ID so it can be cleaned up if payment is cancelled.
 *
 * The event spans from check-in day 16:00 to check-out day 11:00,
 * matching the convention used for actual bookings.
 */
export async function createHoldEvent(
  calendarId: string,
  checkIn: Date,
  checkOut: Date,
  guest: HoldEventInfo,
): Promise<string> {
  const calendar = getCalendarClient()

  const checkInLabel = format(checkIn, "yyyy-MM-dd")
  const checkOutLabel = format(checkOut, "yyyy-MM-dd")
  const createdAt = format(new Date(), "dd/MM/yyyy HH:mm")

  const descriptionLines = [
    `Réservation via Trip'n Book — en attente de paiement`,
    ``,
    `Nom : ${guest.fullName}`,
    `Email : ${guest.email}`,
    `Téléphone : ${guest.phone}`,
    ...(guest.specialNeeds ? [`Demandes : ${guest.specialNeeds}`] : []),
    ``,
    `Créé le ${createdAt}`,
  ]

  const response = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `⏳ Trip'n Book — ${guest.fullName}`,
      description: descriptionLines.join("\n"),
      start: { dateTime: `${checkInLabel}T16:00:00`, timeZone: "Europe/Paris" },
      end: { dateTime: `${checkOutLabel}T11:00:00`, timeZone: "Europe/Paris" },
    },
  })

  const eventId = response.data.id
  if (!eventId) {
    throw new Error("Google Calendar did not return an event ID")
  }

  return eventId
}

/**
 * Updates the hold event after successful payment:
 * removes the ⏳ pending marker and appends a Stripe payment link to the description.
 */
export async function confirmHoldEvent(
  calendarId: string,
  eventId: string,
  paymentIntentId: string,
): Promise<void> {
  const calendar = getCalendarClient()

  const event = await calendar.events.get({ calendarId, eventId })
  const summary = (event.data.summary ?? "").replace("⏳ ", "✅ ")
  const description = (event.data.description ?? "")
    .replace("en attente de paiement", "payé")
    + `\nStripe : ${STRIPE_DASHBOARD_URL}/${paymentIntentId}`

  await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: { summary, description },
  })
}

/**
 * Deletes a hold event (e.g. after payment cancellation or expiry).
 * Silently ignores "not found" errors — the event may have already been removed.
 */
export async function deleteHoldEvent(
  calendarId: string,
  eventId: string,
): Promise<void> {
  const calendar = getCalendarClient()

  try {
    await calendar.events.delete({ calendarId, eventId })
  } catch (err: unknown) {
    const isNotFound = err instanceof Error && "code" in err && (err as { code: number }).code === 404
    if (!isNotFound) throw err
  }
}
