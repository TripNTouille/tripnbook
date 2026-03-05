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
      calendar_url TEXT
    )
  `;

  // Add slug column if it doesn't exist yet (for existing databases)
  await sql`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE
  `;

  // Drop image_url column if it exists (replaced by slug-based convention)
  await sql`
    ALTER TABLE rooms DROP COLUMN IF EXISTS image_url
  `;

  await sql`
    INSERT INTO rooms (name, slug)
    VALUES
      ('Tante Aimée', 'tante-aimee'),
      ('Jules Verne', 'jules-verne'),
      ('Henriette', 'henriette'),
      ('Yukiko', 'yukiko')
    ON CONFLICT (name) DO UPDATE SET slug = EXCLUDED.slug
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

  console.log("✅ Seeded rooms and room_capacities tables");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});