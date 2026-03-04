import { getRoom } from '@/lib/rooms'
import { notFound } from 'next/navigation'

export default async function BookRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const room = await getRoom(Number(roomId))

  if (!room) {
    notFound()
  }

  return (
    <div>
      <h1>{room.name}</h1>
    </div>
  )
}