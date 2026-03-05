"use client"

import * as React from "react"
import type { RoomCapacity } from "@/lib/rooms"
import GuestSelector from "@/components/GuestSelector"
import DateRangePicker from "@/components/DateRangePicker"
import BookingDialog from "@/components/BookingDialog"

type BookingFormProps = {
  roomName: string
  capacity: RoomCapacity
}

export default function BookingForm({ roomName, capacity }: BookingFormProps) {
  const [adultsCount, setAdultsCount] = React.useState(2)
  const [childrenCount, setChildrenCount] = React.useState(0)
  const [dialogDates, setDialogDates] = React.useState<{ from: Date; to: Date } | null>(null)

  function handleAdultsChange(value: number) {
    setAdultsCount(value)
    const allowedChildren = Math.min(capacity.children_max, capacity.capacity - value)
    if (childrenCount > allowedChildren) setChildrenCount(allowedChildren)
  }

  function handleChildrenChange(value: number) {
    setChildrenCount(value)
    const allowedAdults = Math.min(capacity.adults_max, capacity.capacity - value)
    if (adultsCount > allowedAdults) setAdultsCount(allowedAdults)
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
        onBook={(from, to) => setDialogDates({ from, to })}
      />

      {dialogDates && (
        <BookingDialog
          open={true}
          onOpenChange={(open) => { if (!open) setDialogDates(null) }}
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
