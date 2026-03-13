import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import { addMinutes, parseISO, startOfDay } from "date-fns"
import { getHoldDates } from "./booking-logs"
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

const ROOM_NAME = "Jules Verne"
const SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"
const OTHER_SESSION_ID = "660e8400-e29b-41d4-a716-446655440000"

function insertLog(overrides: {
  roomName?: string
  sessionId?: string
  checkIn?: string
  checkOut?: string
  status?: string
  expiresAt?: Date
}) {
  const roomName = overrides.roomName ?? ROOM_NAME
  const sessionId = overrides.sessionId ?? SESSION_ID
  const checkIn = overrides.checkIn ?? "2026-01-10"
  const checkOut = overrides.checkOut ?? "2026-01-13"
  const status = overrides.status ?? "pending"
  const expiresAt = overrides.expiresAt ?? addMinutes(new Date(), 30)

  return db.query(
    `INSERT INTO booking_logs
      (room_id, room_name, adults_count, children_count, check_in, check_out,
       night_count, total_price, email, phone, session_id, status, expires_at)
     VALUES (1, $1, 2, 0, $2, $3, 3, 225, 'test@example.com', '+33 6 00 00 00 00', $4, $5, $6)`,
    [roomName, checkIn, checkOut, sessionId, status, expiresAt.toISOString()],
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

// -- Tests: getHoldDates -----------------------------------------------------

describe("getHoldDates", () => {
  it("returns the nights covered by a pending hold", async () => {
    await insertLog({ checkIn: "2026-01-10", checkOut: "2026-01-13" })

    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.has(startOfDay(parseISO("2026-01-10")).toISOString())).toBe(true)
    expect(dates.has(startOfDay(parseISO("2026-01-11")).toISOString())).toBe(true)
    expect(dates.has(startOfDay(parseISO("2026-01-12")).toISOString())).toBe(true)
    // checkout day is not a booked night
    expect(dates.has(startOfDay(parseISO("2026-01-13")).toISOString())).toBe(false)
  })

  it("returns empty set when no hold exists for the session", async () => {
    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores holds from other sessions", async () => {
    await insertLog({ sessionId: OTHER_SESSION_ID })

    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores holds for other rooms", async () => {
    await insertLog({ roomName: "Tante Aimée" })

    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores expired holds", async () => {
    await insertLog({ expiresAt: new Date(Date.now() - 1000) })

    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores paid holds", async () => {
    await insertLog({ status: "paid" })

    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.size).toBe(0)
  })

  it("ignores cancelled holds", async () => {
    await insertLog({ status: "cancelled" })

    const dates = await getHoldDates(sql, ROOM_NAME, SESSION_ID)

    expect(dates.size).toBe(0)
  })
})