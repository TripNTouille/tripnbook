import * as React from "react"
import { startOfMonth, startOfDay, differenceInDays, addMonths, addDays, format, min, max } from "date-fns"
import { fr } from "date-fns/locale"
import { XIcon } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { useSessionId } from "@/components/SessionIdProvider"
import type { BookingWindow } from "@/lib/booking-window"

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

async function fetchBusyDates(roomId: number, from: Date, to: Date, sessionId: string): Promise<string[]> {
  const params = new URLSearchParams({
    roomId: String(roomId),
    from: from.toISOString(),
    to: to.toISOString(),
    sessionId,
  })
  const response = await fetch(`/api/busy-dates?${params}`)
  if (!response.ok) return []
  const data = await response.json()
  return data.dates ?? []
}

type DateRangePickerProps = {
  roomId: number
  bookingWindow: BookingWindow
  onBook?: (from: Date, to: Date) => void
}

export default function DateRangePicker({ roomId, bookingWindow, onBook }: DateRangePickerProps) {
  const client = useClientReady()
  const sessionId = useSessionId()
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>()

  // All known busy dates as ISO strings (initial + dynamically fetched)
  const [allBusyDates, setAllBusyDates] = React.useState<Set<string>>(
    () => new Set(),
  )

  // Track which month ranges we've already fetched so we don't re-fetch
  const fetchedRangesRef = React.useRef<Set<string>>(new Set())

  // Mark the initial range as already covered and fetch initial busy dates once sessionId is ready
  React.useEffect(() => {
    if (!client || !sessionId) return

    const fetchFrom = max([new Date(), bookingWindow.from])
    const fetchTo = bookingWindow.to

    // Nothing to fetch if the window is already closed
    if (fetchFrom >= fetchTo) return

    const monthsToMark = Math.ceil((fetchTo.getTime() - fetchFrom.getTime()) / (1000 * 60 * 60 * 24 * 30))
    for (let i = 0; i <= monthsToMark; i++) {
      const key = monthKey(addMonths(fetchFrom, i))
      fetchedRangesRef.current.add(key)
    }

    fetchBusyDates(roomId, fetchFrom, fetchTo, sessionId).then((newDates) => {
      if (newDates.length === 0) return
      setAllBusyDates((prev) => {
        const next = new Set(prev)
        for (const d of newDates) next.add(d)
        return next
      })
    })
  }, [roomId, sessionId, client, bookingWindow])

  const busyDateObjects = React.useMemo(
    () => Array.from(allBusyDates).map((iso) => new Date(iso)),
    [allBusyDates],
  )

  // When a date or range is selected, compute which dates to disable.
  // - firstBusyAfter: the next busy night after the selection — allowed as checkout, everything after it blocked
  // - lastBusyBefore: the last busy night before the selection — blocked (and everything before it)
  const selectionBoundaries = React.useMemo(() => {
    const anchor = dateRange?.from
    if (!anchor) return null

    const afterSorted = busyDateObjects
      .filter((d) => d > anchor)
      .sort((a, b) => a.getTime() - b.getTime())
    const firstBusyAfter = afterSorted[0] ?? null

    const beforeSorted = busyDateObjects
      .filter((d) => d < anchor)
      .sort((a, b) => b.getTime() - a.getTime())
    // addDays(+1) so that { before: X } (exclusive) also blocks the busy night itself
    const lastBusyBefore = beforeSorted[0] ? addDays(beforeSorted[0], 1) : null

    return { firstBusyAfter, lastBusyBefore }
  }, [dateRange?.from, busyDateObjects])

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

    // Fetch the full range covering all unfetched months in one request, clamped to booking window
    const from = max([startOfMonth(monthsToFetch[0]), bookingWindow.from])
    const to = min([startOfMonth(addMonths(monthsToFetch[monthsToFetch.length - 1], 1)), bookingWindow.to])

    if (from >= to) return

    fetchBusyDates(roomId, from, to, sessionId).then((newDates) => {
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

  const calendarStartMonth = startOfMonth(max([today, bookingWindow.from]))
  const calendarEndMonth = startOfMonth(bookingWindow.to)

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
        defaultMonth={calendarStartMonth}
        startMonth={calendarStartMonth}
        endMonth={calendarEndMonth}
        modifiers={{
          // Remove strikethrough from firstBusyAfter so it looks selectable as checkout
          busy: selectionBoundaries?.firstBusyAfter
            ? busyDateObjects.filter((d) => d.getTime() !== selectionBoundaries.firstBusyAfter!.getTime())
            : busyDateObjects,
        }}
        modifiersClassNames={{ busy: "line-through" }}
        disabled={[
          { before: max([today, bookingWindow.from]) },
          { after: bookingWindow.to },
          ...(selectionBoundaries
            ? [
                ...(selectionBoundaries.firstBusyAfter ? [{ after: selectionBoundaries.firstBusyAfter }] : []),
                ...(selectionBoundaries.lastBusyBefore ? [{ before: selectionBoundaries.lastBusyBefore }] : []),
              ]
            : busyDateObjects),
        ]}
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