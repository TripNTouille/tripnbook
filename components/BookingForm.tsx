"use client"

import * as React from "react"
import { differenceInDays } from "date-fns"
import type { RoomCapacity } from "@/lib/rooms"
import type { BookingWindow } from "@/lib/booking-window"
import { clampChildrenAfterAdultsChange, clampAdultsAfterChildrenChange } from "@/lib/capacity"
import GuestSelector from "@/components/GuestSelector"
import DateRangePicker from "@/components/DateRangePicker"
import BookingDialog from "@/components/BookingDialog"
import CheckoutResultDialog from "@/components/CheckoutResultDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type BookingFormProps = {
  roomId: number
  roomName: string
  capacity: RoomCapacity
  bookingWindow: BookingWindow
}

export default function BookingForm({ roomId, roomName, capacity, bookingWindow }: BookingFormProps) {
  const [adultsCount, setAdultsCount] = React.useState(2)
  const [childrenCount, setChildrenCount] = React.useState(0)
  const [dialogDates, setDialogDates] = React.useState<{ from: Date; to: Date } | null>(null)
  const [showWeekendDialog, setShowWeekendDialog] = React.useState(false)

  function handleAdultsChange(value: number) {
    setAdultsCount(value)
    setChildrenCount(clampChildrenAfterAdultsChange(capacity, value, childrenCount))
  }

  function handleChildrenChange(value: number) {
    setChildrenCount(value)
    setAdultsCount(clampAdultsAfterChildrenChange(capacity, value, adultsCount))
  }

  function handleBook(from: Date, to: Date) {
    const isSingleNight = differenceInDays(to, from) === 1
    const isWeekendNight = from.getDay() === 5 || from.getDay() === 6 // Friday or Saturday
    if (isSingleNight && isWeekendNight) {
      setShowWeekendDialog(true)
    } else {
      setDialogDates({ from, to })
    }
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
        bookingWindow={bookingWindow}
        onBook={handleBook}
      />

      <CheckoutResultDialog />

      <Dialog open={showWeekendDialog} onOpenChange={setShowWeekendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Séjour d&apos;une nuit en week-end</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Désolé, nous n&apos;acceptons pas les réservations d&apos;une nuit le vendredi ou le samedi.
          </p>
          <p className="text-sm text-muted-foreground">
            Pour une demande spéciale, n&apos;hésitez pas à nous contacter directement via{" "}
            <a
              href="https://tripntouille.com/contact/#nous-ecrire"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              notre formulaire de contact
            </a>
            .
          </p>
          <DialogFooter>
            <Button onClick={() => setShowWeekendDialog(false)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
