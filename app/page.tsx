import { redirect } from "next/navigation"
import { getPublicRooms } from "@/lib/rooms"

export const dynamic = "force-dynamic"

export default async function Home() {
  const rooms = await getPublicRooms()

  if (rooms.length === 0) {
    return <p>Aucune chambre disponible.</p>
  }

  redirect(`/rooms/${rooms[0].id}`)
}