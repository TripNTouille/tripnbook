import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { neon } from "@neondatabase/serverless";

// Load .env.local when it exists (local dev). On Vercel, env vars are injected directly.
const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = (match[2] ?? "").replace(/^["']|["']$/g, "");
    }
  }
}

async function seed() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  const sql = neon(DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS rooms (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      google_calendar_id TEXT
    )
  `;

  // Add slug column if it doesn't exist yet (for existing databases)
  await sql`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
  `;

  // Drop legacy columns if they exist
  await sql`
    ALTER TABLE rooms DROP COLUMN IF EXISTS image_url
  `;
  await sql`
    ALTER TABLE rooms DROP COLUMN IF EXISTS calendar_url
  `;

  // Add google_calendar_id column if it doesn't exist yet
  await sql`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS google_calendar_id TEXT
  `;

  // Add website_url column if it doesn't exist yet
  await sql`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS website_url TEXT
  `;

  const testCalendarId = '6b0cc1d7509e5eaf0ba2593034c4c369c74c612a83452a74265815fa2d979dbd@group.calendar.google.com';

  await sql`
    INSERT INTO rooms (name, slug, google_calendar_id, website_url)
    VALUES
      ('Tante Aimée', 'tante-aimee', ${testCalendarId}, 'https://tripntouille.com/2021/11/15/chambre-tante-aimee/'),
      ('Jules Verne', 'jules-verne', ${testCalendarId}, 'https://tripntouille.com/2021/11/15/chambre-jules-verne/'),
      ('Henriette',   'henriette',  ${testCalendarId}, 'https://tripntouille.com/2022/05/31/chambre-henriette/'),
      ('Yukiko',      'yukiko',     ${testCalendarId}, 'https://tripntouille.com/2022/05/31/chambre-yukiko/')
    ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug, google_calendar_id = EXCLUDED.google_calendar_id, website_url = EXCLUDED.website_url
  `;

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
  `;

  await sql`
    INSERT INTO room_capacities (room_id, capacity, adults_min, adults_max, children_min, children_max)
    VALUES
      ((SELECT id FROM rooms WHERE name = 'Tante Aimée'), 2, 1, 2, 0, 1),
      ((SELECT id FROM rooms WHERE name = 'Jules Verne'), 4, 1, 2, 0, 3),
      ((SELECT id FROM rooms WHERE name = 'Henriette'), 3, 1, 3, 0, 2),
      ((SELECT id FROM rooms WHERE name = 'Yukiko'), 2, 1, 2, 0, 1)
    ON CONFLICT (room_id) DO NOTHING
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS booking_logs (
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
  `;

  // Add full_name column if it doesn't exist yet (for existing databases)
  await sql`
    ALTER TABLE booking_logs ADD COLUMN IF NOT EXISTS full_name TEXT
  `;

  // Add confirmation_sent_at column if it doesn't exist yet (for existing databases)
  await sql`
    ALTER TABLE booking_logs ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ
  `;

  console.log("✅ Seeded rooms, room_capacities, and booking_logs tables");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
