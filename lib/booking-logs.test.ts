import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { addMinutes, parseISO, startOfDay } from "date-fns"
import { getHoldInfo } from "./booking-logs"
import type { SqlExecutor } from "./checkout"

// -- In-memory Postgres via PGlite ------------------------------------------

let db: PGlite

function pgliteToSqlExecutor(pglite: PGlite): SqlExecutor {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let query = strings[0]
    for (let i = 0; i < values.length; i++) {
      query += `$${i + 1}` + strings[i + 1]
    }
    const result = await pglite.query(query, values)
    return result.rows as Record<string, unknown>[]
  }
}

let sql: SqlExecutor

const ROOM_ID = 1
const OTHER_ROOM_ID = 2
const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"
const OTHER_SESSION_ID = "660e8400-e29b-41d4-a716-446655440000"

function insertLog(overrides: {
  roomId?: number
  sessionId?: string
  stripeSessionId?: string | null
  checkIn?: string
  checkOut?: string
  status?: string
  expiresAt?: Date
}) {
  const roomId = overrides.roomId ?? ROOM_ID
  const sessionId = overrides.sessionId ?? SESSION_ID
  const stripeSessionId = overrides.stripeSessionId ?? null
  const checkIn = overrides.checkIn ?? "2026-01-10"
  const checkOut = overrides.checkOut ?? "2026-01-13"
  const status = overrides.status ?? "pending"
  const expiresAt = overrides.expiresAt ?? addMinutes(new Date(), 30)

  return db.query(
    `INSERT INTO booking_logs
      (room_id, room_name, adults_count, children_count, check_in, check_out,
       night_count, total_price, email, phone, stripe_session_id, session_id, status, expires_at)
     VALUES ($1, 'Jules Verne', 2, 0, $2, $3, 3, 225, 'test@example.com', '+33 6 00 00 00 00', $4, $5, $6, $7)`,
    [roomId, checkIn, checkOut, stripeSessionId, sessionId, status, expiresAt.toISOString()],
  )
}

// -- Setup / teardown --------------------------------------------------------

beforeAll(async () => {
  db = new PGlite()
  sql = pgliteToSqlExecutor(db)

  await db.query(`
    CREATE TABLE booking_logs (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL,
      room_name TEXT NOT NULL,
      full_name TEXT,
      adults_count INTEGER NOT NULL,
      children_count INTEGER NOT NULL,
      check_in TEXT NOT NULL,
      check_out TEXT NOT NULL,
      night_count INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      special_needs TEXT,
      stripe_session_id TEXT,
      session_id TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
})

beforeEach(async () => {
  await db.query("DELETE FROM booking_logs")
})

afterAll(async () => {
  await db.close()
})

// -- Tests: getHoldInfo ------------------------------------------------------

const FAKE_STRIPE_SESSION_ID = "cs_test_abc123"

describe("getHoldInfo", () => {
  it("returns the nights covered by a pending hold", async () => {
    await insertLog({ checkIn: "2026-01-10", checkOut: "2026-01-13" })

    const { dates } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.has(startOfDay(parseISO("2026-01-10")).toISOString())).toBe(true)
    expect(dates.has(startOfDay(parseISO("2026-01-11")).toISOString())).toBe(true)
    expect(dates.has(startOfDay(parseISO("2026-01-12")).toISOString())).toBe(true)
    // checkout day is not a booked night
    expect(dates.has(startOfDay(parseISO("2026-01-13")).toISOString())).toBe(false)
  })

  it("returns the stripe session id of the hold", async () => {
    await insertLog({ stripeSessionId: FAKE_STRIPE_SESSION_ID })

    const { stripeSessionId } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(stripeSessionId).toBe(FAKE_STRIPE_SESSION_ID)
  })

  it("returns empty dates and null stripeSessionId when no hold exists", async () => {
    const { dates, stripeSessionId } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.size).toBe(0)
    expect(stripeSessionId).toBeNull()
  })

  it("ignores holds from other sessions", async () => {
    await insertLog({ sessionId: OTHER_SESSION_ID })

    const { dates } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores holds for other rooms", async () => {
    await insertLog({ roomId: OTHER_ROOM_ID })

    const { dates } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores expired holds", async () => {
    await insertLog({ expiresAt: new Date(Date.now() - 1000) })

    const { dates } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores paid holds", async () => {
    await insertLog({ status: "paid" })

    const { dates } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores cancelled holds", async () => {
    await insertLog({ status: "cancelled" })

    const { dates } = await getHoldInfo(sql, ROOM_ID, SESSION_ID)

    expect(dates.size).toBe(0)
  })
})