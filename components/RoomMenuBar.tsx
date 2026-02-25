import Link from 'next/link'
import { rooms } from '@/lib/rooms'

export default function RoomMenuBar() {
  return (
    <nav className="hidden md:block bg-black py-3 px-6">
      <ul className="flex items-center justify-center gap-8 text-white text-sm font-medium tracking-wide">
        {rooms.map((room) => (
          <li key={room.id} className="hover:underline cursor-pointer">
            <Link href={`/book/${ room.id }`}>{ room.name }</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
