import type { SqlExecutor } from "./db"
import { parseISO, startOfDay, addDays } from "date-fns"

export type BookingLog = {
  id: number
  room_id: number
  room_name: string
  full_name: string | null
  adults_count: number
  children_count: number
  check_in: string
  check_out: string
  night_count: number
  total_price: number
  email: string
  phone: string
  special_needs: string | null
  stripe_session_id: string | null
  session_id: string
  status: string
  created_at: Date
  expires_at: Date
}

export type BookingLogInput = {
  roomId: number
  roomName: string
  fullName: string | null
  adultsCount: number
  childrenCount: number
  checkIn: string
  checkOut: string
  nightCount: number
  totalPrice: number
  email: string
  phone: string
  specialNeeds: string | null
  stripeSessionId: string
  expiresAt: Date
  sessionId: string
}

export async function insertBookingLog(
  sql: SqlExecutor,
  input: BookingLogInput,
): Promise<void> {
  const { roomId, roomName, fullName, adultsCount, childrenCount, checkIn, checkOut,
    nightCount, totalPrice, email, phone, specialNeeds, stripeSessionId, expiresAt, sessionId } = input
  await sql`
    INSERT INTO booking_logs
      (room_id, room_name, full_name, adults_count, children_count, check_in, check_out,
       night_count, total_price, email, phone, special_needs, stripe_session_id, expires_at, session_id)
    VALUES
      (${roomId}, ${roomName}, ${fullName}, ${adultsCount}, ${childrenCount}, ${checkIn}, ${checkOut},
       ${nightCount}, ${totalPrice}, ${email}, ${phone}, ${specialNeeds || null}, ${stripeSessionId}, ${expiresAt}, ${sessionId})
  `
}

export type HoldInfo = {
  dates: Set<string>
  stripeSessionId: string | null
}

export async function getHoldInfo(
  sql: SqlExecutor,
  roomId: number,
  sessionId: string,
): Promise<HoldInfo> {
  const rows = await sql`
    SELECT check_in, check_out, stripe_session_id
    FROM booking_logs
    WHERE room_id = ${roomId}
      AND session_id = ${sessionId}
      AND status = 'pending'
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `

  const dates = new Set<string>()

  if (rows.length === 0) {
    return { dates, stripeSessionId: null }
  }

  const row = rows[0]
  const checkIn = startOfDay(parseISO(row.check_in as string))
  const checkOut = startOfDay(parseISO(row.check_out as string))
  let day = checkIn
  while (day < checkOut) {
    dates.add(day.toISOString())
    day = addDays(day, 1)
  }

  return { dates, stripeSessionId: row.stripe_session_id as string | null }
}

export async function updateBookingLogStatus(
  sql: SqlExecutor,
  stripeSessionId: string,
  status: "paid" | "cancelled",
): Promise<BookingLog[]> {
  const rows = await sql`
    UPDATE booking_logs
    SET status = ${status}
    WHERE stripe_session_id = ${stripeSessionId} AND status = 'pending'
    RETURNING *
  `

  return rows as BookingLog[]
}
