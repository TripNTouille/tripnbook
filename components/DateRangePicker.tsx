import * as React from "react"
import { startOfMonth, startOfDay, differenceInDays, addMonths, format } from "date-fns"
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

async function fetchBusyDates(roomId: number, from: Date, to: Date): Promise<string[]> {
  const params = new URLSearchParams({
    roomId: String(roomId),
    from: from.toISOString(),
    to: to.toISOString(),
  })
  const response = await fetch(`/api/busy-dates?${params}`)
  if (!response.ok) return []
  const data = await response.json()
  return data.dates ?? []
}

type DateRangePickerProps = {
  roomId: number
  busyDates?: string[]
  onBook?: (from: Date, to: Date) => void
}

export default function DateRangePicker({ roomId, busyDates = [], onBook }: DateRangePickerProps) {
  const client = useClientReady()
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()

  // All known busy dates as ISO strings (initial + dynamically fetched)
  const [allBusyDates, setAllBusyDates] = React.useState<Set<string>>(
    () => new Set(busyDates),
  )

  // Track which month ranges we've already fetched so we don't re-fetch
  const fetchedRangesRef = React.useRef<Set<string>>(new Set())

  // Mark the initial server-fetched range as already covered (visible months + 1 buffer on each side)
  React.useEffect(() => {
    const now = new Date()
    for (let i = 0; i < 5; i++) {
      const key = monthKey(addMonths(now, i))
      fetchedRangesRef.current.add(key)
    }
  }, [])

  const busyDateObjects = React.useMemo(
    () => Array.from(allBusyDates).map((iso) => new Date(iso)),
    [allBusyDates],
  )

  function handleMonthChange(month: Date) {
    if (!client) return
    const visibleMonths = client.isDesktop ? 3 : 1

    // Visible months + 1 buffer before + 1 buffer after
    const monthsToFetch: Date[] = []
    for (let i = -1; i <= visibleMonths; i++) {
      const m = addMonths(month, i)
      const key = monthKey(m)
      if (!fetchedRangesRef.current.has(key)) {
        fetchedRangesRef.current.add(key)
        monthsToFetch.push(m)
      }
    }

    if (monthsToFetch.length === 0) return

    // Fetch the full range covering all unfetched months in one request
    const from = startOfMonth(monthsToFetch[0])
    const to = startOfMonth(addMonths(monthsToFetch[monthsToFetch.length - 1], 1))

    fetchBusyDates(roomId, from, to).then((newDates) => {
      if (newDates.length === 0) return
      setAllBusyDates((prev) => {
        const next = new Set(prev)
        for (const d of newDates) next.add(d)
        return next
      })
    })
  }

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
        min={1}
        numberOfMonths={isDesktop ? 3 : 1}
        showOutsideDays={false}
        selected={dateRange}
        onSelect={setDateRange}
        onMonthChange={handleMonthChange}
        defaultMonth={today}
        startMonth={startOfMonth(today)}
        modifiers={{ busy: busyDateObjects }}
        modifiersClassNames={{ busy: "line-through" }}
        disabled={[{ before: today }, ...busyDateObjects]}
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
            Voir le tarif
          </Button>
        </div>
      )}
    </div>
  )
}

/** Stable string key for a given month, e.g. "2025-07" */
function monthKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}