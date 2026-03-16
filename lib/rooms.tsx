import { getDb } from "@/lib/db";

export type Room = {
  id: number;
  name: string;
  slug: string;
  google_calendar_id: string | null;
  website_url: string | null;
};

export type PublicRoom = {
  id: number;
  name: string;
  slug: string;
  website_url: string | null;
};

export type RoomCapacity = {
  capacity: number;
  adults_min: number;
  adults_max: number;
  children_min: number;
  children_max: number;
};

export async function getRooms(): Promise<Room[]> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, slug, google_calendar_id, website_url FROM rooms ORDER BY id`;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    google_calendar_id: r.google_calendar_id as string | null,
    website_url: r.website_url as string | null,
  }));
}

export async function getPublicRooms(): Promise<PublicRoom[]> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, slug, website_url FROM rooms ORDER BY id`;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    website_url: r.website_url as string | null,
  }));
}

export async function getRoom(roomId: number): Promise<Room | null> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, slug, google_calendar_id, website_url FROM rooms WHERE id = ${roomId} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
    google_calendar_id: r.google_calendar_id as string | null,
    website_url: r.website_url as string | null,
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
