import { getDb } from "@/lib/db";

export type Room = {
  id: number;
  name: string;
  slug: string;
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
  const rows = await sql`SELECT id, name, slug FROM rooms ORDER BY id`;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
  }));
}

export async function getRoom(roomId: number): Promise<Room | null> {
  const sql = getDb();
  const rows = await sql`SELECT id, name, slug FROM rooms WHERE id = ${roomId} LIMIT 1`;
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id as number,
    name: r.name as string,
    slug: r.slug as string,
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