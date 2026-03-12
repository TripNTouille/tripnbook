import { getRoom, getRoomCapacity, getRooms } from '@/lib/rooms'
import { notFound } from 'next/navigation'
import { ExternalLinkIcon } from "lucide-react"
import BookingForm from '@/components/BookingForm'
import RoomMenuBar from '@/components/RoomMenuBar'
import Image from 'next/image'

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
    <div>
      <div className="relative w-full h-[30vh]">
          {/* Images follow the convention: /rooms/{slug}/main.jpg */}
          <Image
            src={`/rooms/${room.slug}/main.jpg`}
            fill
            alt={room.name}
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/70 px-12 py-6">
              <h1 className="text-white text-3xl md:text-5xl font-semibold tracking-wide">
                {room.name}
              </h1>
            </div>
          </div>
        </div>

      <RoomMenuBar rooms={await getRooms()} />

      <div className="flex justify-center w-full mt-4">
        <div className="flex flex-col gap-4">
          {capacity && (
            <BookingForm roomId={room.id} roomName={room.name} capacity={capacity} />
          )}
        </div>
      </div>

      {room.website_url && (
        <div className="flex justify-center mt-4">
          <a
            href={room.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
          >
            <ExternalLinkIcon className="size-3.5" />
            En savoir plus sur cette chambre
          </a>
        </div>
      )}
    </div>
  )
}
