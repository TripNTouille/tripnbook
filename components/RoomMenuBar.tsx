"use client"

import Link from 'next/link'
import { MenuIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import type { Room } from '@/lib/rooms'

export default function RoomMenuBar({ rooms }: { rooms: Room[] }) {
  const [open, setOpen] = useState(false)

  return (
    <nav className="bg-black text-white text-sm font-medium tracking-wide">
      {/* Desktop */}
      <ul className="hidden md:flex items-center justify-center gap-8 py-3 px-6">
        {rooms.map((room) => (
          <li key={room.id} className="hover:underline cursor-pointer">
            <Link href={`/book/${room.id}`}>{room.name}</Link>
          </li>
        ))}
      </ul>

      {/* Mobile */}
      <div className="md:hidden relative">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="font-semibold">Nos chambres</span>
          <button onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
          </button>
        </div>

        {open && (
          <ul className="absolute left-0 right-0 z-50 flex flex-col gap-1 bg-black px-4 pb-3">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/book/${room.id}`}
                  className="block py-2 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  {room.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  )
}