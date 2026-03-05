import * as React from "react"
import { startOfMonth, startOfDay, differenceInDays, format } from "date-fns"
import { fr } from "date-fns/locale"
import { XIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"

function useClientReady() {
  const [ready, setReady] = React.useState<{
    today: Date
    isDesktop: boolean
  } | null>(null)

  React.useEffect(() => {
    setReady({
      today: startOfDay(new Date()),
      isDesktop: window.matchMedia("(min-width: 768px)").matches,
    })

    function handleResize(e: MediaQueryListEvent) {
      setReady((prev) =>
        prev ? { ...prev, isDesktop: e.matches } : null
      )
    }

    const mql = window.matchMedia("(min-width: 768px)")
    mql.addEventListener("change", handleResize)
    return () => mql.removeEventListener("change", handleResize)
  }, [])

  return ready
}

type DateRangePickerProps = {
  onBook?: (from: Date, to: Date) => void
}

export default function DateRangePicker({ onBook }: DateRangePickerProps) {
  const client = useClientReady()
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()

  if (!client) return null

  const { today, isDesktop } = client

  const hasCompleteRange = dateRange?.from && dateRange?.to
  const nightCount = hasCompleteRange
    ? differenceInDays(dateRange.to!, dateRange.from!)
    : 0

  return (
    <div className="flex flex-col items-center md:items-end gap-4">
      <Calendar
        mode="range"
        numberOfMonths={isDesktop ? 3 : 1}
        showOutsideDays={false}
        selected={dateRange}
        onSelect={setDateRange}
        defaultMonth={today}
        startMonth={startOfMonth(today)}
        disabled={{ before: today }}
      />

      {hasCompleteRange && (
        <div className="flex flex-col md:flex-row items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm text-center">
              du {format(dateRange.from!, "d MMM yyyy", { locale: fr })} au{" "}
              {format(dateRange.to!, "d MMM yyyy", { locale: fr })} ({nightCount}{" "}
              {nightCount > 1 ? "nuits" : "nuit"})
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              title="Annuler"
              onClick={() => setDateRange(undefined)}
            >
              <XIcon />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => onBook?.(dateRange.from!, dateRange.to!)}
          >
            Réserver
          </Button>
        </div>
      )}
    </div>
  )
}
