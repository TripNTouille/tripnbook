"use client"

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

export default function GuestSelector({ capacity }: { capacity: RoomCapacity }) {
  const [adults, setAdults] = React.useState(2)
  const [children, setChildren] = React.useState(0)

  const maxAdults = capacity.capacity - children
  const maxChildren = capacity.capacity - adults

  function handleAdultsChange(value: string) {
    const newAdults = Number(value)
    setAdults(newAdults)

    const allowedChildren = Math.min(capacity.children_max, capacity.capacity - newAdults)
    if (children > allowedChildren) setChildren(allowedChildren)
  }

  function handleChildrenChange(value: string) {
    const newChildren = Number(value)
    setChildren(newChildren)

    const allowedAdults = Math.min(capacity.adults_max, capacity.capacity - newChildren)
    if (adults > allowedAdults) setAdults(allowedAdults)
  }

  return (
    <div className="flex items-center gap-4">
      <Select value={String(adults)} onValueChange={handleAdultsChange}>
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

      <Select value={String(children)} onValueChange={handleChildrenChange}>
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
