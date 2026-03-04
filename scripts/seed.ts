import { neon } from "@neondatabase/serverless";

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
      calendar_url TEXT
    )
  `;

  await sql`
    INSERT INTO rooms (name)
    VALUES
      ('Tante Aimée'),
      ('Jules Verne'),
      ('Henriette'),
      ('Yukiko')
    ON CONFLICT (name) DO NOTHING
  `;

  console.log("✅ Seeded rooms table with 4 rows");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});