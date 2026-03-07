import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest"
import { PGlite } from "@electric-sql/pglite"
import type Stripe from "stripe"
import {
  createCheckoutSession,
  retrieveCheckoutSession,
  handleGetSession,
  type SqlExecutor,
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
} = {}): Stripe {
  const sessionId = overrides.sessionId ?? FAKE_SESSION_ID
  const paymentStatus = overrides.paymentStatus ?? "paid"

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
        retrieve: async () => ({
          id: sessionId,
          url: FAKE_CHECKOUT_URL,
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
          },
        }),
      },
    },
  } as unknown as Stripe
}

// -- Test fixtures -----------------------------------------------------------

const validInput = {
  roomName: "Jules Verne",
  adultsCount: 2,
  childrenCount: 0,
  from: "1 janv. 2026",
  to: "4 janv. 2026",
  nightCount: 3,
  totalPrice: 225,
  email: "test@example.com",
  phone: "+33 6 00 00 00 00",
  specialNeeds: "",
  returnUrl: "/book/2",
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
    const result = await createCheckoutSession(stripe, sql, validInput)

    expect(result.url).toBe(FAKE_CHECKOUT_URL)
  })

  it("inserts a booking log with status 'pending'", async () => {
    const stripe = makeMockStripe()
    await createCheckoutSession(stripe, sql, validInput)

    const rows = (await db.query("SELECT * FROM booking_logs")).rows as Record<string, unknown>[]
    expect(rows).toHaveLength(1)

    const log = rows[0]
    expect(log.room_name).toBe("Jules Verne")
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
    await createCheckoutSession(stripe, sql, { ...validInput, specialNeeds: "" })

    const rows = (await db.query("SELECT special_needs FROM booking_logs")).rows as Record<string, unknown>[]
    expect(rows[0].special_needs).toBeNull()
  })

  it("stores special_needs when provided", async () => {
    const stripe = makeMockStripe()
    await createCheckoutSession(stripe, sql, { ...validInput, specialNeeds: "Lit bébé SVP" })

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

    await createCheckoutSession(stripe, sql, validInput)

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

    await createCheckoutSession(stripe, sql, { ...validInput, nightCount: 1, totalPrice: 80 })

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

    await createCheckoutSession(stripe, sql, { ...validInput, adultsCount: 2, childrenCount: 1 })

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

    await createCheckoutSession(stripe, sql, validInput)

    expect(capturedParams!.success_url).toBe(
      "http://localhost:3000/book/2?checkout=success&session_id={CHECKOUT_SESSION_ID}"
    )
    expect(capturedParams!.cancel_url).toBe(
      "http://localhost:3000/book/2?checkout=cancelled&session_id={CHECKOUT_SESSION_ID}"
    )
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

    const result = await retrieveCheckoutSession(stripe, sql, FAKE_SESSION_ID)

    expect(result.paymentStatus).toBe("paid")
    expect(result.customerEmail).toBe("test@example.com")
    expect(result.amountTotal).toBe(22500)
    expect(result.metadata.roomName).toBe("Jules Verne")
  })

  it("updates booking log status to 'paid' on successful payment", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })

    await retrieveCheckoutSession(stripe, sql, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("updates booking log status to 'cancelled' on unpaid session", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "unpaid" })

    await retrieveCheckoutSession(stripe, sql, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("cancelled")
  })

  it("does not update a log that is already 'paid' (idempotency)", async () => {
    await insertPendingLog()
    const stripePaid = makeMockStripe({ paymentStatus: "paid" })
    await retrieveCheckoutSession(stripePaid, sql, FAKE_SESSION_ID)

    // Second call with a mock that would return "unpaid" — should NOT overwrite "paid"
    const stripeUnpaid = makeMockStripe({ paymentStatus: "unpaid" })
    await retrieveCheckoutSession(stripeUnpaid, sql, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("does not update a log that is already 'cancelled' (idempotency)", async () => {
    await insertPendingLog()
    const stripeCancelled = makeMockStripe({ paymentStatus: "unpaid" })
    await retrieveCheckoutSession(stripeCancelled, sql, FAKE_SESSION_ID)

    // Second call with "paid" — should NOT overwrite "cancelled"
    const stripePaid = makeMockStripe({ paymentStatus: "paid" })
    await retrieveCheckoutSession(stripePaid, sql, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("cancelled")
  })

  it("handles missing booking log gracefully (no row to update)", async () => {
    const stripe = makeMockStripe({ paymentStatus: "paid" })

    // Should not throw even though there's no matching row
    const result = await retrieveCheckoutSession(stripe, sql, "cs_nonexistent")

    expect(result.paymentStatus).toBe("paid")
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
    const response = await handleGetSession(stripe, sql, null)

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

    const response = await handleGetSession(stripe, sql, "cs_invalid_id")

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: "Session not found" })
  })

  it("returns 200 with session data on successful payment", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "paid" })

    const response = await handleGetSession(stripe, sql, FAKE_SESSION_ID)

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

    await handleGetSession(stripe, sql, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("returns 200 and updates log to 'cancelled' on unpaid session", async () => {
    await insertPendingLog()
    const stripe = makeMockStripe({ paymentStatus: "unpaid" })

    const response = await handleGetSession(stripe, sql, FAKE_SESSION_ID)

    expect(response.status).toBe(200)
    expect(response.body.paymentStatus).toBe("unpaid")

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("cancelled")
  })

  it("does not update an already-paid log on subsequent call", async () => {
    await insertPendingLog()
    const stripePaid = makeMockStripe({ paymentStatus: "paid" })
    await handleGetSession(stripePaid, sql, FAKE_SESSION_ID)

    const stripeUnpaid = makeMockStripe({ paymentStatus: "unpaid" })
    await handleGetSession(stripeUnpaid, sql, FAKE_SESSION_ID)

    const rows = (await db.query("SELECT status FROM booking_logs WHERE stripe_session_id = $1", [FAKE_SESSION_ID])).rows as Record<string, unknown>[]
    expect(rows[0].status).toBe("paid")
  })

  it("returns 200 even when no booking log exists for the session", async () => {
    const stripe = makeMockStripe({ paymentStatus: "paid" })

    const response = await handleGetSession(stripe, sql, FAKE_SESSION_ID)

    expect(response.status).toBe(200)
    expect(response.body.paymentStatus).toBe("paid")
  })
})