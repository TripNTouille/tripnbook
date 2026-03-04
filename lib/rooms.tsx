import { neon } from "@neondatabase/serverless";

export type Room = {
  id: number;
  name: string;
  calendar_url: string | null;
};

function getDb() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error("Missing DATABASE_URL environment variable");
  }
  return neon(DATABASE_URL);
}

export async function getRooms(): Promise<Room[]> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, calendar_url FROM rooms ORDER BY id`;
  return rows as Room[];
}

export async function getRoom(roomId: number): Promise<Room | null> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, calendar_url FROM rooms WHERE id = ${roomId} LIMIT 1`;
  return (rows[0] as Room) ?? null;
}