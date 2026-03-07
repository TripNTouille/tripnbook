import { describe, it, expect } from "vitest"
import {
  allowedAdultsRange,
  allowedChildrenRange,
  clampChildrenAfterAdultsChange,
  clampAdultsAfterChildrenChange,
} from "./capacity"
import type { RoomCapacity } from "./rooms"

// Room configurations from seed data
const tanteAimee: RoomCapacity = { capacity: 2, adults_min: 1, adults_max: 2, children_min: 0, children_max: 1 }
const julesVerne: RoomCapacity = { capacity: 4, adults_min: 1, adults_max: 2, children_min: 0, children_max: 3 }
const henriette: RoomCapacity = { capacity: 3, adults_min: 1, adults_max: 3, children_min: 0, children_max: 2 }
const yukiko: RoomCapacity = { capacity: 2, adults_min: 1, adults_max: 2, children_min: 0, children_max: 1 }

describe("allowedAdultsRange", () => {
  it("Tante Aimée: 0 children → adults 1-2", () => {
    expect(allowedAdultsRange(tanteAimee, 0)).toEqual({ min: 1, max: 2 })
  })

  it("Tante Aimée: 1 child → adults 1-1 (capacity constrains before adults_max)", () => {
    expect(allowedAdultsRange(tanteAimee, 1)).toEqual({ min: 1, max: 1 })
  })

  it("Jules Verne: 0 children → adults 1-2 (adults_max constrains before capacity)", () => {
    expect(allowedAdultsRange(julesVerne, 0)).toEqual({ min: 1, max: 2 })
  })

  it("Jules Verne: 3 children → adults 1-1", () => {
    expect(allowedAdultsRange(julesVerne, 3)).toEqual({ min: 1, max: 1 })
  })

  it("Henriette: 0 children → adults 1-3", () => {
    expect(allowedAdultsRange(henriette, 0)).toEqual({ min: 1, max: 3 })
  })

  it("Henriette: 2 children → adults 1-1", () => {
    expect(allowedAdultsRange(henriette, 2)).toEqual({ min: 1, max: 1 })
  })

  it("Henriette: 1 child → adults 1-2 (capacity constrains before adults_max)", () => {
    expect(allowedAdultsRange(henriette, 1)).toEqual({ min: 1, max: 2 })
  })
})

describe("allowedChildrenRange", () => {
  it("Tante Aimée: 1 adult → children 0-1", () => {
    expect(allowedChildrenRange(tanteAimee, 1)).toEqual({ min: 0, max: 1 })
  })

  it("Tante Aimée: 2 adults → children 0-0 (room is full)", () => {
    expect(allowedChildrenRange(tanteAimee, 2)).toEqual({ min: 0, max: 0 })
  })

  it("Jules Verne: 1 adult → children 0-3", () => {
    expect(allowedChildrenRange(julesVerne, 1)).toEqual({ min: 0, max: 3 })
  })

  it("Jules Verne: 2 adults → children 0-2 (capacity constrains before children_max)", () => {
    expect(allowedChildrenRange(julesVerne, 2)).toEqual({ min: 0, max: 2 })
  })

  it("Henriette: 1 adult → children 0-2", () => {
    expect(allowedChildrenRange(henriette, 1)).toEqual({ min: 0, max: 2 })
  })

  it("Henriette: 3 adults → children 0-0 (room is full)", () => {
    expect(allowedChildrenRange(henriette, 3)).toEqual({ min: 0, max: 0 })
  })

  it("Yukiko: 1 adult → children 0-1", () => {
    expect(allowedChildrenRange(yukiko, 1)).toEqual({ min: 0, max: 1 })
  })

  it("Yukiko: 2 adults → children 0-0", () => {
    expect(allowedChildrenRange(yukiko, 2)).toEqual({ min: 0, max: 0 })
  })
})

describe("clampChildrenAfterAdultsChange", () => {
  it("no clamping needed when children still fit", () => {
    expect(clampChildrenAfterAdultsChange(julesVerne, 1, 2)).toBe(2)
  })

  it("clamps children down when adults increase fills the room", () => {
    // Jules Verne: was 1 adult + 3 children, now 2 adults → max children = 2
    expect(clampChildrenAfterAdultsChange(julesVerne, 2, 3)).toBe(2)
  })

  it("clamps to 0 when room is full of adults", () => {
    expect(clampChildrenAfterAdultsChange(tanteAimee, 2, 1)).toBe(0)
  })

  it("children already at 0 stays at 0", () => {
    expect(clampChildrenAfterAdultsChange(henriette, 3, 0)).toBe(0)
  })

  it("Henriette: 2 adults, 2 children → clamps children to 1", () => {
    expect(clampChildrenAfterAdultsChange(henriette, 2, 2)).toBe(1)
  })
})

describe("clampAdultsAfterChildrenChange", () => {
  it("no clamping needed when adults still fit", () => {
    expect(clampAdultsAfterChildrenChange(julesVerne, 1, 2)).toBe(2)
  })

  it("clamps adults down when children increase fills the room", () => {
    // Henriette: was 3 adults + 0 children, now 2 children → max adults = 1
    expect(clampAdultsAfterChildrenChange(henriette, 2, 3)).toBe(1)
  })

  it("clamps to adults_min when room is nearly full of children", () => {
    // Jules Verne: 3 children → capacity - 3 = 1, adults_max = 2 → min(2, 1) = 1
    expect(clampAdultsAfterChildrenChange(julesVerne, 3, 2)).toBe(1)
  })

  it("Tante Aimée: 1 child, 2 adults → clamps adults to 1", () => {
    expect(clampAdultsAfterChildrenChange(tanteAimee, 1, 2)).toBe(1)
  })

  it("adults already within range stays unchanged", () => {
    expect(clampAdultsAfterChildrenChange(yukiko, 0, 1)).toBe(1)
  })
})