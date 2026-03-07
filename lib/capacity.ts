import type { RoomCapacity } from "@/lib/rooms"

export type GuestCounts = {
  adultsCount: number
  childrenCount: number
}

/**
 * Given the current number of children, returns the allowed range for adults.
 */
export function allowedAdultsRange(capacity: RoomCapacity, childrenCount: number) {
  const max = Math.min(capacity.adults_max, capacity.capacity - childrenCount)
  return { min: capacity.adults_min, max }
}

/**
 * Given the current number of adults, returns the allowed range for children.
 */
export function allowedChildrenRange(capacity: RoomCapacity, adultsCount: number) {
  const max = Math.min(capacity.children_max, capacity.capacity - adultsCount)
  return { min: capacity.children_min, max }
}

/**
 * When adults count changes, clamp children if they exceed the new allowed max.
 * Returns the (possibly adjusted) children count.
 */
export function clampChildrenAfterAdultsChange(capacity: RoomCapacity, newAdults: number, currentChildren: number): number {
  const { max } = allowedChildrenRange(capacity, newAdults)
  return Math.min(currentChildren, max)
}

/**
 * When children count changes, clamp adults if they exceed the new allowed max.
 * Returns the (possibly adjusted) adults count.
 */
export function clampAdultsAfterChildrenChange(capacity: RoomCapacity, newChildren: number, currentAdults: number): number {
  const { max } = allowedAdultsRange(capacity, newChildren)
  return Math.min(currentAdults, max)
}