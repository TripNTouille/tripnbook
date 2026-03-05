import * as React from "react"
import type { RoomCapacity } from "@/lib/rooms"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function range(min: number, max: number): number[] {
  const result: number[] = []
  for (let i = min; i <= max; i++) result.push(i)
  return result
}

type GuestSelectorProps = {
  capacity: RoomCapacity
  adultsCount: number
  childrenCount: number
  onAdultsChange: (value: number) => void
  onChildrenChange: (value: number) => void
}

export default function GuestSelector({
  capacity,
  adultsCount,
  childrenCount,
  onAdultsChange,
  onChildrenChange,
}: GuestSelectorProps) {
  const maxAdults = capacity.capacity - childrenCount
  const maxChildren = capacity.capacity - adultsCount

  return (
    <div className="flex items-center gap-4">
      <Select value={String(adultsCount)} onValueChange={(v) => onAdultsChange(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {range(capacity.adults_min, Math.min(capacity.adults_max, maxAdults)).map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} {n > 1 ? "adultes" : "adulte"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(childrenCount)} onValueChange={(v) => onChildrenChange(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {range(capacity.children_min, Math.min(capacity.children_max, maxChildren)).map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} {n > 1 ? "enfants" : "enfant"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}