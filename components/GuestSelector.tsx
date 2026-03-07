import * as React from "react"
import type { RoomCapacity } from "@/lib/rooms"
import { allowedAdultsRange, allowedChildrenRange } from "@/lib/capacity"
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
  const adults = allowedAdultsRange(capacity, childrenCount)
  const children = allowedChildrenRange(capacity, adultsCount)

  return (
    <div className="flex items-center gap-4">
      <Select value={String(adultsCount)} onValueChange={(v) => onAdultsChange(Number(v))}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {range(adults.min, adults.max).map((n) => (
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
          {range(children.min, children.max).map((n) => (
            <SelectItem key={n} value={String(n)}>
              {n} {n > 1 ? "enfants" : "enfant"}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}