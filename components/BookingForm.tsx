"use client"

import * as React from "react"
import type { RoomCapacity } from "@/lib/rooms"
import { clampChildrenAfterAdultsChange, clampAdultsAfterChildrenChange } from "@/lib/capacity"
import GuestSelector from "@/components/GuestSelector"
import DateRangePicker from "@/components/DateRangePicker"
import BookingDialog from "@/components/BookingDialog"
import CheckoutResultDialog from "@/components/CheckoutResultDialog"

type BookingFormProps = {
  roomId: number
  roomName: string
  capacity: RoomCapacity
  busyDates: string[]
}

export default function BookingForm({ roomId, roomName, capacity, busyDates }: BookingFormProps) {
  const [adultsCount, setAdultsCount] = React.useState(2)
  const [childrenCount, setChildrenCount] = React.useState(0)
  const [dialogDates, setDialogDates] = React.useState<{ from: Date; to: Date } | null>(null)

  function handleAdultsChange(value: number) {
    setAdultsCount(value)
    setChildrenCount(clampChildrenAfterAdultsChange(capacity, value, childrenCount))
  }

  function handleChildrenChange(value: number) {
    setChildrenCount(value)
    setAdultsCount(clampAdultsAfterChildrenChange(capacity, value, adultsCount))
  }

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
        <span className="text-sm font-medium">Nombre d&apos;hôtes :</span>
        <GuestSelector
          capacity={capacity}
          adultsCount={adultsCount}
          childrenCount={childrenCount}
          onAdultsChange={handleAdultsChange}
          onChildrenChange={handleChildrenChange}
        />
      </div>

      <DateRangePicker
        roomId={roomId}
        busyDates={busyDates}
        onBook={(from, to) => setDialogDates({ from, to })}
      />

      <CheckoutResultDialog />

      {dialogDates && (
        <BookingDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDialogDates(null) }}
          roomId={roomId}
          roomName={roomName}
          adultsCount={adultsCount}
          childrenCount={childrenCount}
          from={dialogDates.from}
          to={dialogDates.to}
        />
      )}
    </>
  )
}
