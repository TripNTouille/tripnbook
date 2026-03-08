import { google } from "googleapis"
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns"

const SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

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
): Promise<Date[]> {
  const auth = getAuth()
  const calendar = google.calendar({ version: "v3", auth })

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