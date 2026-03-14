import { neon } from "@neondatabase/serverless"
import { loadEnv } from "./load-env"

loadEnv()

async function createSchema() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.log("No DATABASE_URL found, skipping schema creation")
    return
  }

  const sql = neon(DATABASE_URL)

  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      google_calendar_id TEXT,
      website_url TEXT
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS room_capacities (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES rooms(id),
      capacity INTEGER NOT NULL,
      adults_min INTEGER NOT NULL,
      adults_max INTEGER NOT NULL,
      children_min INTEGER NOT NULL,
      children_max INTEGER NOT NULL,
      UNIQUE (room_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS booking_logs (
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
  `

  console.log("✅ Schema created")
}

createSchema().catch((err) => {
  console.error("Schema creation failed:", err)
  process.exit(1)
})