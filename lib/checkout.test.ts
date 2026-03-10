import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import type Stripe from "stripe"
import {
  createCheckoutSession,
  retrieveCheckoutSession,
  handleGetSession,
  fulfillSession,
  handleWebhookEvent,
  DatesUnavailableError,
  type SqlExecutor,
  type CalendarDeps,
  type EmailDeps,
} from "./checkout"

// -- In-memory Postgres via PGlite ------------------------------------------

let db: PGlite

/** Adapts PGlite's `query(sql, params)` to the tagged-template interface used by Neon */
function pgliteToSqlExecutor(pglite: PGlite): SqlExecutor {
  return async (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Build a parameterized query: "SELECT $1, $2" with values array
    let query = strings[0]
    for (let i = 0; i < values.length; i++) {
      query += `$${i + 1}` + strings[i + 1]
    }
    const result = await pglite.query(query, values)
    return result.rows as Record<string, unknown>[]
  }
}

let sql: SqlExecutor

// -- Stripe mock -------------------------------------------------------------

const FAKE_SESSION_ID = "cs_test_abc123"
const FAKE_CHECKOUT_URL = "https://checkout.stripe.com/pay/cs_test_abc123"

function makeMockStripe(overrides: {
  paymentStatus?: string
  sessionId?: string
  metadata?: Record<string, string>
} = {}): Stripe {
  const sessionId = overrides.sessionId ?? FAKE_SESSION_ID
  const paymentStatus = overrides.paymentStatus ?? "paid"

  const session = {
    id: sessionId,
    url: FAKE_CHECKOUT_URL,
    payment_intent: "pi_test_abc123",
    payment_status: paymentStatus,
    customer_email: "test@example.com",
    amount_total: 22500,
    metadata: {
      roomName: "Jules Verne",
      adultsCount: "2",
      childrenCount: "0",
      from: "1 janv. 2026",
      to: "4 janv. 2026",
      nightCount: "3",
      phone: "+33 6 00 00 00 00",
      specialNeeds: "",
      ...(overrides.metadata ?? {}),
    },
  }

  return {
    checkout: {
      sessions: {
        create: async (params: Stripe.Checkout.SessionCreateParams) => ({
          id: sessionId,
          url: FAKE_CHECKOUT_URL,
          payment_status: "unpaid",
          customer_email: params.customer_email,
          amount_total: (params.line_items?.[0] as { price_data: { unit_amount: number } })?.price_data?.unit_amount ?? 0,
          metadata: params.metadata,
        }),
        retrieve: async () => session,
      },
    },
    webhooks: {
      constructEvent: (_payload: unknown, _sig: unknown, secret: string) => {
        if (secret !== FAKE_WEBHOOK_SECRET) throw new Error("Invalid signature")
        return { type: "checkout.session.completed", data: { object: session } } as unknown as Stripe.Event
      },
    },
  } as unknown as Stripe
}

/**
 * Builds a minimal Stripe.Checkout.Session object for use in fulfillSession tests,
 * without needing a full Stripe mock.
 */
function makeSession(overrides: {
  paymentStatus?: string
  metadata?: Record<string, string>
} = {}): Stripe.Checkout.Session {
  return {
    id: FAKE_SESSION_ID,
    payment_intent: "pi_test_abc123",
    payment_status: overrides.paymentStatus ?? "paid",
    metadata: {
      ...(overrides.metadata ?? {}),
    },
  } as unknown as Stripe.Checkout.Session
}

// -- Calendar mock -----------------------------------------------------------

const FAKE_EVENT_ID = "gcal_event_123"
const FAKE_CALENDAR_ID = "room-calendar@group.calendar.google.com"
const FAKE_WEBHOOK_SECRET = "whsec_test_secret"

function makeMockCalendar(overrides: {
  calendarId?: string | null
  datesFree?: boolean
  holdEventId?: string
} = {}): CalendarDeps & {
  calls: {
    getCalendarId: number
    areDatesFree: number
    createHoldEvent: number
    confirmHoldEvent: number
    deleteHoldEvent: number
  }
  deletedEvents: string[]
} {
  const calendarId = overrides.calendarId === undefined ? FAKE_CALENDAR_ID : overrides.calendarId
  const datesFree = overrides.datesFree ?? true
  const holdEventId = overrides.holdEventId ?? FAKE_EVENT_ID

  const calls = { getCalendarId: 0, areDatesFree: 0, createHoldEvent: 0, confirmHoldEvent: 0, deleteHoldEvent: 0 }
  const deletedEvents: string[] = []

  return {
    calls,
    deletedEvents,
    getCalendarId: async () => {
      calls.getCalendarId++
      return calendarId
    },
    areDatesFree: async () => {
      calls.areDatesFree++
      return datesFree
    },
    createHoldEvent: async () => {
      calls.createHoldEvent++
      return holdEventId
    },
    confirmHoldEvent: async () => {
      calls.confirmHoldEvent++
    },
    deleteHoldEvent: async (_calendarId, eventId) => {
      calls.deleteHoldEvent++
      deletedEvents.push(eventId)
    },
  }
}

// -- Email mock --------------------------------------------------------------

function makeEmailDeps(): EmailDeps & { confirmationsSent: number } {
  let confirmationsSent = 0
  return {
    get confirmationsSent() { return confirmationsSent },
    sendConfirmation: async () => { confirmationsSent++ },
  }
}

// -- Test fixtures -----------------------------------------------------------

const validInput = {
  roomId: 2,
  roomName: "Jules Verne",
  adultsCount: 2,
  childrenCount: 0,
  from: "1 janv. 2026",
  to: "4 janv. 2026",
  fromDate: "2026-01-01",
  toDate: "2026-01-04",
  nightCount: 3,
  totalPrice: 225,
  fullName: "Jean Dupont",
  email: "test@example.com",
  phone: "+33 6 00 00 00 00",
  specialNeeds: "",
  returnUrl: "/rooms/2",
  origin: "http://localhost:3000",
}

// -- Setup / teardown --------------------------------------------------------

beforeAll(async () => {
  db = new PGlite()
  sql = pgliteToSqlExecutor(db)

  await db.query(`
    CREATE TABLE booking_logs (
      id SERIAL PRIMARY KEY,
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
      status TEXT NOT NULL DEFAULT 'pending',
      confirmation_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
})

beforeEach(async () => {
  await db.query("DELETE FROM booking_logs")
})

afterAll(async () => {
  await db.close()
})

// -- Tests: createCheckoutSession --------------------------------------------

describe("createCheckoutSession", () => {
  it("returns the Stripe checkout URL", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar()
    const result = await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(result.url).toBe(FAKE_CHECKOUT_URL)
  })

  it("inserts a booking log with status 'pending'", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar()
    await createCheckoutSession(stripe, sql, calendar, validInput)

    const rows = (await db.query("SELECT * FROM booking_logs")).rows as Record<string, unknown>[]
    expect(rows).toHaveLength(1)

    const log = rows[0]
    expect(log.room_name).toBe("Jules Verne")
    expect(log.full_name).toBe("Jean Dupont")
    expect(log.adults_count).toBe(2)
    expect(log.children_count).toBe(0)
    expect(log.check_in).toBe("1 janv. 2026")
    expect(log.check_out).toBe("4 janv. 2026")
    expect(log.night_count).toBe(3)
    expect(log.total_price).toBe(225)
    expect(log.email).toBe("test@example.com")
    expect(log.phone).toBe("+33 6 00 00 00 00")
    expect(log.stripe_session_id).toBe(FAKE_SESSION_ID)
    expect(log.status).toBe("pending")
  })

  it("stores null for empty special_needs", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar()
    await createCheckoutSession(stripe, sql, calendar, { ...validInput, specialNeeds: "" })

    const rows = (await db.query("SELECT special_needs FROM booking_logs")).rows as Record<string, unknown>[]
    expect(rows[0].special_needs).toBeNull()
  })

  it("stores special_needs when provided", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar()
    await createCheckoutSession(stripe, sql, calendar, { ...validInput, specialNeeds: "Lit bébé SVP" })

    const rows = (await db.query("SELECT special_needs FROM booking_logs")).rows as Record<string, unknown>[]
    expect(rows[0].special_needs).toBe("Lit bébé SVP")
  })

  it("passes correct line item to Stripe", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | null = null
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            capturedParams = params
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar()

    await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(capturedParams).not.toBeNull()
    expect(capturedParams!.customer_email).toBe("test@example.com")
    expect(capturedParams!.mode).toBe("payment")

    const lineItem = capturedParams!.line_items![0] as { price_data: { unit_amount: number; currency: string; product_data: { name: string } } }
    expect(lineItem.price_data.unit_amount).toBe(22500)
    expect(lineItem.price_data.currency).toBe("eur")
    expect(lineItem.price_data.product_data.name).toBe("Jules Verne — 3 nuits")
  })

  it("uses singular 'nuit' for single-night bookings", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | null = null
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            capturedParams = params
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar()

    await createCheckoutSession(stripe, sql, calendar, { ...validInput, nightCount: 1, totalPrice: 80 })

    const lineItem = capturedParams!.line_items![0] as { price_data: { product_data: { name: string } } }
    expect(lineItem.price_data.product_data.name).toBe("Jules Verne — 1 nuit")
  })

  it("includes children in the guest label", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | null = null
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            capturedParams = params
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar()

    await createCheckoutSession(stripe, sql, calendar, { ...validInput, adultsCount: 2, childrenCount: 1 })

    const lineItem = capturedParams!.line_items![0] as { price_data: { product_data: { description: string } } }
    expect(lineItem.price_data.product_data.description).toContain("3 pers. (2 ad., 1 enf.)")
  })

  it("builds correct success and cancel URLs", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | null = null
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            capturedParams = params
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar()

    await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(capturedParams!.success_url).toBe(
      "http://localhost:3000/rooms/2?checkout=success&session_id={CHECKOUT_SESSION_ID}"
    )
    expect(capturedParams!.cancel_url).toBe(
      "http://localhost:3000/rooms/2?checkout=cancelled&session_id={CHECKOUT_SESSION_ID}"
    )
  })
})

// -- Tests: availability check & hold event ----------------------------------

describe("createCheckoutSession — calendar integration", () => {
  it("checks availability before creating the Stripe session", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ datesFree: true })

    await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(calendar.calls.getCalendarId).toBe(1)
    expect(calendar.calls.areDatesFree).toBe(1)
  })

  it("creates a hold event when dates are free", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ datesFree: true })

    await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(calendar.calls.createHoldEvent).toBe(1)
  })

  it("stores calendarId and holdEventId in Stripe metadata", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | null = null
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            capturedParams = params
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar()

    await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(capturedParams!.metadata!.calendarId).toBe(FAKE_CALENDAR_ID)
    expect(capturedParams!.metadata!.holdEventId).toBe(FAKE_EVENT_ID)
  })

  it("throws DatesUnavailableError when dates are taken", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ datesFree: false })

    await expect(
      createCheckoutSession(stripe, sql, calendar, validInput)
    ).rejects.toThrow(DatesUnavailableError)
  })

  it("does not create a hold event when dates are taken", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ datesFree: false })

    try {
      await createCheckoutSession(stripe, sql, calendar, validInput)
    } catch { /* expected */ }

    expect(calendar.calls.createHoldEvent).toBe(0)
  })

  it("does not create a Stripe session when dates are taken", async () => {
    let stripeCreateCalled = false
    const stripe = {
      checkout: {
        sessions: {
          create: async () => {
            stripeCreateCalled = true
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar({ datesFree: false })

    try {
      await createCheckoutSession(stripe, sql, calendar, validInput)
    } catch { /* expected */ }

    expect(stripeCreateCalled).toBe(false)
  })

  it("does not insert a booking log when dates are taken", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ datesFree: false })

    try {
      await createCheckoutSession(stripe, sql, calendar, validInput)
    } catch { /* expected */ }

    const rows = (await db.query("SELECT * FROM booking_logs")).rows
    expect(rows).toHaveLength(0)
  })

  it("skips calendar operations when room has no calendar ID", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ calendarId: null })

    const result = await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(result.url).toBe(FAKE_CHECKOUT_URL)
    expect(calendar.calls.areDatesFree).toBe(0)
    expect(calendar.calls.createHoldEvent).toBe(0)
  })

  it("does not include calendarId/holdEventId in metadata when room has no calendar", async () => {
    let capturedParams: Stripe.Checkout.SessionCreateParams | null = null
    const stripe = {
      checkout: {
        sessions: {
          create: async (params: Stripe.Checkout.SessionCreateParams) => {
            capturedParams = params
            return { id: FAKE_SESSION_ID, url: FAKE_CHECKOUT_URL }
          },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar({ calendarId: null })

    await createCheckoutSession(stripe, sql, calendar, validInput)

    expect(capturedParams!.metadata!.calendarId).toBeUndefined()
    expect(capturedParams!.metadata!.holdEventId).toBeUndefined()
  })

  it("cleans up hold event if Stripe session creation fails", async () => {
    const stripe = {
      checkout: {
        sessions: {
          create: async () => { throw new Error("Stripe is down") },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar({ datesFree: true })

    try {
      await createCheckoutSession(stripe, sql, calendar, validInput)
    } catch { /* expected */ }

    expect(calendar.calls.deleteHoldEvent).toBe(1)
    expect(calendar.deletedEvents).toEqual([FAKE_EVENT_ID])
  })

  it("cleans up hold event if booking_logs INSERT fails", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar({ datesFree: true })

    const brokenSql: SqlExecutor = async (strings, ...values) => {
      // Let SELECT-like queries through; fail only on INSERT
      const query = strings.join("?")
      if (query.toLowerCase().includes("insert")) {
        throw new Error("DB is down")
      }
      return []
    }

    try {
      await createCheckoutSession(stripe, brokenSql, calendar, validInput)
    } catch { /* expected */ }

    expect(calendar.calls.deleteHoldEvent).toBe(1)
    expect(calendar.deletedEvents).toEqual([FAKE_EVENT_ID])
  })
})

// -- Tests: retrieveCheckoutSession ------------------------------------------

describe("retrieveCheckoutSession", () => {
  async function insertPendingLog(sessionId: string = FAKE_SESSION_ID) {
    await db.query(
      `INSERT INTO booking_logs
        (room_name, adults_count, children_count, check_in, check_out,
         night_count, total_price, email, phone, stripe_session_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
      ["Jules Verne", 2, 0, "1 janv. 2026", "4 janv. 2026", 3, 225, "test@example.com", "+33 6 00 00 00 00", sessionId]
    )
  }

  it("returns session data when payment is successful", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const result = await retrieveCheckoutSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(result.paymentStatus).toBe("paid")
    expect(result.customerEmail).toBe("test@example.com")
    expect(result.amountTotal).toBe(22500)
    expect(result.metadata.roomName).toBe("Jules Verne")
  })

  it("updates booking log status to 'paid' on successful payment", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await retrieveCheckoutSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("updates booking log status to 'cancelled' on unpaid session", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "unpaid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await retrieveCheckoutSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("cancelled")
  })

  it("does not update a log that is already 'paid' (idempotency)", async () => {
    await insertPendingLog()
    const stripePaid = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()
    await retrieveCheckoutSession(stripePaid, sql, calendar, email, FAKE_SESSION_ID)

    // Second call with a mock that would return "unpaid" — should NOT overwrite "paid"
    const stripeUnpaid = makeMockStripe({ paymentStatus: "unpaid" })
    await retrieveCheckoutSession(stripeUnpaid, sql, calendar, email, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("does not update a log that is already 'cancelled' (idempotency)", async () => {
    await insertPendingLog()
    const stripeCancelled = makeMockStripe({ paymentStatus: "unpaid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()
    await retrieveCheckoutSession(stripeCancelled, sql, calendar, email, FAKE_SESSION_ID)

    // Second call with "paid" — should NOT overwrite "cancelled"
    const stripePaid = makeMockStripe({ paymentStatus: "paid" })
    await retrieveCheckoutSession(stripePaid, sql, calendar, email, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("cancelled")
  })

  it("handles missing booking log gracefully (no row to update)", async () => {
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    // Should not throw even though there's no matching row
    const result = await retrieveCheckoutSession(stripe, sql, calendar, email, "cs_nonexistent")

    expect(result.paymentStatus).toBe("paid")
  })

  it("deletes the hold event when payment is cancelled", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({
      paymentStatus: "unpaid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await retrieveCheckoutSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(calendar.calls.deleteHoldEvent).toBe(1)
    expect(calendar.deletedEvents).toEqual([FAKE_EVENT_ID])
  })

  it("confirms the hold event when payment is successful", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({
      paymentStatus: "paid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await retrieveCheckoutSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(calendar.calls.confirmHoldEvent).toBe(1)
    expect(calendar.calls.deleteHoldEvent).toBe(0)
  })

  it("does not attempt deletion when no holdEventId in metadata", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "unpaid", metadata: {} })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await retrieveCheckoutSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(calendar.calls.deleteHoldEvent).toBe(0)
  })
})

// -- Tests: handleGetSession (HTTP-level) ------------------------------------

describe("handleGetSession", () => {
  async function insertPendingLog(sessionId: string = FAKE_SESSION_ID) {
    await db.query(
      `INSERT INTO booking_logs
        (room_name, adults_count, children_count, check_in, check_out,
         night_count, total_price, email, phone, stripe_session_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
      ["Jules Verne", 2, 0, "1 janv. 2026", "4 janv. 2026", 3, 225, "test@example.com", "+33 6 00 00 00 00", sessionId]
    )
  }

  it("returns 400 when session_id is null", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()
    const response = await handleGetSession(stripe, sql, calendar, email, null)

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: "Missing session_id" })
  })

  it("returns 404 when Stripe cannot find the session", async () => {
    const stripe = {
      checkout: {
        sessions: {
          retrieve: async () => { throw new Error("No such checkout session") },
        },
      },
    } as unknown as Stripe
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleGetSession(stripe, sql, calendar, email, "cs_invalid_id")

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: "Session not found" })
  })

  it("returns 200 with session data on successful payment", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleGetSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(response.status).toBe(200)
    expect(response.body.paymentStatus).toBe("paid")
    expect(response.body.customerEmail).toBe("test@example.com")
    expect(response.body.amountTotal).toBe(22500)

    const metadata = response.body.metadata as Record<string, string>
    expect(metadata.roomName).toBe("Jules Verne")
    expect(metadata.nightCount).toBe("3")
  })

  it("returns 200 and updates log to 'paid'", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await handleGetSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("returns 200 and updates log to 'cancelled' on unpaid session", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "unpaid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleGetSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(response.status).toBe(200)
    expect(response.body.paymentStatus).toBe("unpaid")

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("cancelled")
  })

  it("does not update an already-paid log on subsequent call", async () => {
    await insertPendingLog()
    const stripePaid = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()
    await handleGetSession(stripePaid, sql, calendar, email, FAKE_SESSION_ID)

    const stripeUnpaid = makeMockStripe({ paymentStatus: "unpaid" })
    await handleGetSession(stripeUnpaid, sql, calendar, email, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("returns 200 even when no booking log exists for the session", async () => {
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleGetSession(stripe, sql, calendar, email, FAKE_SESSION_ID)

    expect(response.status).toBe(200)
    expect(response.body.paymentStatus).toBe("paid")
  })
})

// -- Tests: fulfillSession ---------------------------------------------------

describe("fulfillSession", () => {
  async function insertPendingLog() {
    await sql`
      INSERT INTO booking_logs
        (room_name, full_name, adults_count, children_count, check_in, check_out,
         night_count, total_price, email, phone, stripe_session_id)
      VALUES
        ('Jules Verne', 'Jean Dupont', 2, 0, '1 janv. 2026', '4 janv. 2026',
         3, 225, 'test@example.com', '+33 6 00 00 00 00', ${FAKE_SESSION_ID})
    `
  }

  it("updates booking log to 'paid' when session is paid", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("paid")
  })

  it("updates booking log to 'cancelled' when session is unpaid", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "unpaid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("cancelled")
  })

  it("is idempotent — does not overwrite an already-paid log", async () => {
    await insertPendingLog()
    const paidSession = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, paidSession)

    // Second call with unpaid should not flip the status back
    const unpaidSession = makeSession({ paymentStatus: "unpaid" })
    await fulfillSession(sql, calendar, email, unpaidSession)

    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("paid")
  })

  it("confirms the hold event when session is paid", async () => {
    await insertPendingLog()
    const session = makeSession({
      paymentStatus: "paid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    expect(calendar.calls.confirmHoldEvent).toBe(1)
    expect(calendar.calls.deleteHoldEvent).toBe(0)
  })

  it("deletes the hold event when session is unpaid", async () => {
    await insertPendingLog()
    const session = makeSession({
      paymentStatus: "unpaid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    expect(calendar.calls.deleteHoldEvent).toBe(1)
    expect(calendar.deletedEvents).toEqual([FAKE_EVENT_ID])
  })

  it("does not touch the calendar when no holdEventId in metadata", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid", metadata: {} })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    expect(calendar.calls.confirmHoldEvent).toBe(0)
    expect(calendar.calls.deleteHoldEvent).toBe(0)
  })

  it("handles missing booking log gracefully (no row to update)", async () => {
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    // Should not throw even with no matching log row
    await expect(fulfillSession(sql, calendar, email, session)).resolves.toBeUndefined()
  })

  it("sends a confirmation email when session is paid", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    expect(email.confirmationsSent).toBe(1)
  })

  it("does not send an email when session is unpaid", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "unpaid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    expect(email.confirmationsSent).toBe(0)
  })

  it("does not send an email on replayed paid event (log already paid)", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)
    // Second call — row is no longer 'pending', so no email should be sent again
    await fulfillSession(sql, calendar, email, session)

    expect(email.confirmationsSent).toBe(1)
  })

  it("sends exactly one email when redirect and webhook race", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    // Simulate redirect and webhook calling fulfillSession concurrently
    await Promise.all([
      fulfillSession(sql, calendar, email, session),
      fulfillSession(sql, calendar, email, session),
    ])

    expect(email.confirmationsSent).toBe(1)
  })

  it("does not throw when confirmHoldEvent fails", async () => {
    await insertPendingLog()
    const session = makeSession({
      paymentStatus: "paid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar: CalendarDeps = {
      ...makeMockCalendar(),
      confirmHoldEvent: async () => { throw new Error("Google Calendar is down") },
    }
    const email = makeEmailDeps()

    await expect(fulfillSession(sql, calendar, email, session)).resolves.toBeUndefined()
  })

  it("does not throw when deleteHoldEvent fails", async () => {
    await insertPendingLog()
    const session = makeSession({
      paymentStatus: "unpaid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar: CalendarDeps = {
      ...makeMockCalendar(),
      deleteHoldEvent: async () => { throw new Error("Google Calendar is down") },
    }
    const email = makeEmailDeps()

    await expect(fulfillSession(sql, calendar, email, session)).resolves.toBeUndefined()
  })

  it("does not throw when sendConfirmation fails", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email: EmailDeps = {
      sendConfirmation: async () => { throw new Error("Resend is down") },
    }

    await expect(fulfillSession(sql, calendar, email, session)).resolves.toBeUndefined()
  })

  it("still sends the email even when confirmHoldEvent fails", async () => {
    await insertPendingLog()
    const session = makeSession({
      paymentStatus: "paid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar: CalendarDeps = {
      ...makeMockCalendar(),
      confirmHoldEvent: async () => { throw new Error("Google Calendar is down") },
    }
    const email = makeEmailDeps()

    await fulfillSession(sql, calendar, email, session)

    expect(email.confirmationsSent).toBe(1)
  })

  it("still updates the booking log when sendConfirmation fails", async () => {
    await insertPendingLog()
    const session = makeSession({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email: EmailDeps = {
      sendConfirmation: async () => { throw new Error("Resend is down") },
    }

    await fulfillSession(sql, calendar, email, session)

    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("paid")
  })
})

// -- Tests: handleWebhookEvent -----------------------------------------------

describe("handleWebhookEvent", () => {
  async function insertPendingLog() {
    await sql`
      INSERT INTO booking_logs
        (room_name, full_name, adults_count, children_count, check_in, check_out,
         night_count, total_price, email, phone, stripe_session_id)
      VALUES
        ('Jules Verne', 'Jean Dupont', 2, 0, '1 janv. 2026', '4 janv. 2026',
         3, 225, 'test@example.com', '+33 6 00 00 00 00', ${FAKE_SESSION_ID})
    `
  }

  it("returns 400 when the webhook signature is invalid", async () => {
    const stripe = makeMockStripe()
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleWebhookEvent(
      stripe, sql, calendar, email,
      Buffer.from("payload"), "wrong-signature", "wrong-secret",
    )

    expect(response.status).toBe(400)
    expect(response.body.error).toBe("Invalid webhook signature")
  })

  it("returns 200 and fulfils the booking on checkout.session.completed", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleWebhookEvent(
      stripe, sql, calendar, email,
      Buffer.from("payload"), "valid-signature", FAKE_WEBHOOK_SECRET,
    )

    expect(response.status).toBe(200)
    expect(response.body.received).toBe(true)

    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("paid")
  })

  it("returns 200 and cleans up on checkout.session.expired", async () => {
    await insertPendingLog()

    // Override constructEvent to emit an expired event with an unpaid session
    const expiredStripe = {
      checkout: { sessions: { retrieve: async () => ({}) } },
      webhooks: {
        constructEvent: (_payload: unknown, _sig: unknown, secret: string) => {
          if (secret !== FAKE_WEBHOOK_SECRET) throw new Error("Invalid signature")
          return {
            type: "checkout.session.expired",
            data: {
              object: makeSession({
                paymentStatus: "unpaid",
                metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
              }),
            },
          } as unknown as Stripe.Event
        },
      },
    } as unknown as Stripe

    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleWebhookEvent(
      expiredStripe, sql, calendar, email,
      Buffer.from("payload"), "valid-signature", FAKE_WEBHOOK_SECRET,
    )

    expect(response.status).toBe(200)

    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("cancelled")
    expect(calendar.calls.deleteHoldEvent).toBe(1)
  })

  it("returns 200 without fulfilling anything for unhandled event types", async () => {
    await insertPendingLog()

    const unhandledStripe = {
      webhooks: {
        constructEvent: (_payload: unknown, _sig: unknown, secret: string) => {
          if (secret !== FAKE_WEBHOOK_SECRET) throw new Error("Invalid signature")
          return { type: "payment_intent.created", data: { object: {} } } as unknown as Stripe.Event
        },
      },
    } as unknown as Stripe

    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    const response = await handleWebhookEvent(
      unhandledStripe, sql, calendar, email,
      Buffer.from("payload"), "valid-signature", FAKE_WEBHOOK_SECRET,
    )

    expect(response.status).toBe(200)

    // Log must still be pending — we did nothing
    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("pending")
  })

  it("is idempotent — replayed completed event does not flip booking log back", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({
      paymentStatus: "paid",
      metadata: { calendarId: FAKE_CALENDAR_ID, holdEventId: FAKE_EVENT_ID },
    })
    const calendar = makeMockCalendar()
    const email = makeEmailDeps()

    await handleWebhookEvent(stripe, sql, calendar, email, Buffer.from("p"), "sig", FAKE_WEBHOOK_SECRET)
    await handleWebhookEvent(stripe, sql, calendar, email, Buffer.from("p"), "sig", FAKE_WEBHOOK_SECRET)

    // DB log is still 'paid' after two calls
    const rows = await sql`SELECT status FROM booking_logs WHERE stripe_session_id = ${FAKE_SESSION_ID}`
    expect(rows[0].status).toBe("paid")

    // Calendar ops are idempotent by design (confirmHoldEvent does a patch, deleteHoldEvent ignores 404s),
    // so being called twice is harmless — no need to assert the count here
  })
})
