import { getRoom, getRoomCapacity } from '@/lib/rooms'
import { notFound } from 'next/navigation'
import BookingForm from '@/components/BookingForm'

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

  const capacity = await getRoomCapacity(room.id)

  return (
    <div className="flex justify-center w-full mt-4">
      <div className="flex flex-col gap-4">
        {capacity && (
          <BookingForm roomName={room.name} capacity={capacity} />
        )}
      </div>
    </div>
  )
}