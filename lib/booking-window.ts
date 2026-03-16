import { parseISO, addDays } from "date-fns"

export type BookingWindow = {
  from: Date
  to: Date
}

export function getBookingWindow(): BookingWindow {
  const minEnv = process.env.BOOKING_MIN_DATE
  const maxEnv = process.env.BOOKING_MAX_DATE

  const today = new Date()

  // Default from=today, to=yesterday so the window is closed when env vars are not set
  const from = minEnv ? parseISO(minEnv) : today
  const to = maxEnv ? parseISO(maxEnv) : addDays(today, -1)

  return { from, to }
}