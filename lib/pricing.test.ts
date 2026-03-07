import { describe, it, expect } from "vitest"
import { calculatePrice } from "./pricing"

describe("calculatePrice", () => {
  describe("single night (80€ base rate)", () => {
    it("1 guest, 1 night → 80€", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 1, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 0, totalPrice: 80 })
    })

    it("2 guests, 1 night → 80€", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 2, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 0, totalPrice: 80 })
    })

    it("1 adult + 1 child, 1 night → 80€ (2 guests total, no surcharge)", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 1, childrenCount: 1 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 0, totalPrice: 80 })
    })

    it("3 guests, 1 night → 100€ (80 + 1×20)", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 2, childrenCount: 1 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 1, totalPrice: 100 })
    })

    it("4 guests, 1 night → 120€ (80 + 2×20)", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 2, childrenCount: 2 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 2, totalPrice: 120 })
    })
  })

  describe("multiple nights (75€ base rate)", () => {
    it("1 guest, 2 nights → 150€", () => {
      const result = calculatePrice({ nightCount: 2, adultsCount: 1, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 0, totalPrice: 150 })
    })

    it("2 guests, 3 nights → 225€", () => {
      const result = calculatePrice({ nightCount: 3, adultsCount: 2, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 0, totalPrice: 225 })
    })

    it("3 guests, 2 nights → 190€ (75 + 1×20) × 2", () => {
      const result = calculatePrice({ nightCount: 2, adultsCount: 2, childrenCount: 1 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 1, totalPrice: 190 })
    })

    it("4 guests, 2 nights → 230€ (75 + 2×20) × 2", () => {
      const result = calculatePrice({ nightCount: 2, adultsCount: 1, childrenCount: 3 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 2, totalPrice: 230 })
    })

    it("4 guests, 7 nights → 805€ (75 + 2×20) × 7", () => {
      const result = calculatePrice({ nightCount: 7, adultsCount: 2, childrenCount: 2 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 2, totalPrice: 805 })
    })
  })

  describe("extra guest surcharge applies equally to adults and children", () => {
    it("3 adults + 0 children same price as 2 adults + 1 child", () => {
      const allAdults = calculatePrice({ nightCount: 2, adultsCount: 3, childrenCount: 0 })
      const mixed = calculatePrice({ nightCount: 2, adultsCount: 2, childrenCount: 1 })
      expect(allAdults.totalPrice).toBe(mixed.totalPrice)
    })
  })
})