import { getRoom } from '@/lib/rooms'

export default async function BookRoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>
}) {
  const { roomId } = await params
  const room = getRoom(roomId)

  return (
    <div>
      <h1>{room.name}</h1>
    </div>
  )
}
