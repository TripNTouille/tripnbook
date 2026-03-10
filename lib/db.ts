import { neon } from "@neondatabase/serverless";

export function getDb() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }
  return neon(DATABASE_URL);
}
