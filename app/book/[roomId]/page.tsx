import { getRoom, getRoomCapacity } from '@/lib/rooms'
import { notFound } from 'next/navigation'
import DateRangePicker from '@/components/DateRangePicker'
import GuestSelector from '@/components/GuestSelector'

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
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Nombre d&apos;hôtes :</span>
            <GuestSelector capacity={capacity} />
          </div>
        )}
        <DateRangePicker />
      </div>
    </div>
  )
}
