import { neon } from "@neondatabase/serverless";

export type Room = {
  id: number;
  name: string;
  slug: string;
  calendar_url: string | null;
};

export type RoomCapacity = {
  capacity: number;
  adults_min: number;
  adults_max: number;
  children_min: number;
  children_max: number;
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
  const rows = await sql`SELECT id, name, slug, calendar_url FROM rooms ORDER BY id`;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    calendar_url: r.calendar_url as string | null,
  }));
}

export async function getRoom(roomId: number): Promise<Room | null> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, slug, calendar_url FROM rooms WHERE id = ${roomId} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    calendar_url: r.calendar_url as string | null,
  };
}

export async function getRoomCapacity(roomId: number): Promise<RoomCapacity | null> {
  const sql = getDb();
  const rows = await sql`
    SELECT capacity, adults_min, adults_max, children_min, children_max
    FROM room_capacities
    WHERE room_id = ${roomId}
    LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    capacity: r.capacity as number,
    adults_min: r.adults_min as number,
    adults_max: r.adults_max as number,
    children_min: r.children_min as number,
    children_max: r.children_max as number,
  };
}