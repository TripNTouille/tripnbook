import { neon } from "@neondatabase/serverless";

/**
 * A SQL tagged-template executor compatible with both Neon and PGlite adapters.
 * Accepts a template and returns an array of row objects.
 */
export type SqlExecutor = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => Promise<Record<string, unknown>[]>

export function getDb() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }
  return neon(DATABASE_URL);
}
