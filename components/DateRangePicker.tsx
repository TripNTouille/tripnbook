"use client"

import * as React from "react"
import { startOfMonth, startOfDay, differenceInDays, format } from "date-fns"
import { fr } from "date-fns/locale"
import { XIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"

export default function DateRangePicker() {
  const [today, setToday] = React.useState<Date | null>(null)
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()

  React.useEffect(() => {
    setToday(startOfDay(new Date()))
  }, [])

  if (!today) return null

  const hasCompleteRange = dateRange?.from && dateRange?.to
  const nightCount = hasCompleteRange
    ? differenceInDays(dateRange.to!, dateRange.from!)
    : 0

  return (
    <div className="flex flex-col items-end gap-4">
      <Calendar
        mode="range"
        numberOfMonths={3}
        selected={dateRange}
        onSelect={setDateRange}
        defaultMonth={today}
        startMonth={startOfMonth(today)}
        disabled={{ before: today }}
      />

      {hasCompleteRange && (
        <div className="flex items-center gap-3">
          <span className="text-sm">
            du {format(dateRange.from!, "d MMM yyyy", { locale: fr })} au{" "}
            {format(dateRange.to!, "d MMM yyyy", { locale: fr })} ({nightCount}{" "}
            {nightCount > 1 ? "nuits" : "nuit"})
          </span>
          <Button size="sm">Réserver</Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Annuler"
            onClick={() => setDateRange(undefined)}
          >
            <XIcon />
          </Button>
        </div>
      )}
    </div>
  )
}