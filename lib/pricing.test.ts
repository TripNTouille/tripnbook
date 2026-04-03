import { describe, it, expect } from "vitest"
import { calculatePrice, SERVICE_FEE } from "./pricing"

describe("calculatePrice", () => {
  describe("single night (80€ base rate)", () => {
    it("1 guest, 1 night → stayPrice 80€, totalPrice 82€", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 1, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 0, stayPrice: 80, platformFee: SERVICE_FEE, totalPrice: 82 })
    })

    it("2 guests, 1 night → stayPrice 80€, totalPrice 82€", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 2, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 0, stayPrice: 80, platformFee: SERVICE_FEE, totalPrice: 82 })
    })

    it("1 adult + 1 child, 1 night → stayPrice 80€, totalPrice 82€ (2 guests total, no surcharge)", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 1, childrenCount: 1 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 0, stayPrice: 80, platformFee: SERVICE_FEE, totalPrice: 82 })
    })

    it("3 guests, 1 night → stayPrice 100€ (80 + 1×20), totalPrice 102€", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 2, childrenCount: 1 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 1, stayPrice: 100, platformFee: SERVICE_FEE, totalPrice: 102 })
    })

    it("4 guests, 1 night → stayPrice 120€ (80 + 2×20), totalPrice 122€", () => {
      const result = calculatePrice({ nightCount: 1, adultsCount: 2, childrenCount: 2 })
      expect(result).toEqual({ pricePerNight: 80, pricePerExtraGuest: 20, extraGuests: 2, stayPrice: 120, platformFee: SERVICE_FEE, totalPrice: 122 })
    })
  })

  describe("multiple nights (75€ base rate)", () => {
    it("1 guest, 2 nights → stayPrice 150€, totalPrice 152€", () => {
      const result = calculatePrice({ nightCount: 2, adultsCount: 1, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 0, stayPrice: 150, platformFee: SERVICE_FEE, totalPrice: 152 })
    })

    it("2 guests, 3 nights → stayPrice 225€, totalPrice 227€", () => {
      const result = calculatePrice({ nightCount: 3, adultsCount: 2, childrenCount: 0 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 0, stayPrice: 225, platformFee: SERVICE_FEE, totalPrice: 227 })
    })

    it("3 guests, 2 nights → stayPrice 190€ (75 + 1×20) × 2, totalPrice 192€", () => {
      const result = calculatePrice({ nightCount: 2, adultsCount: 2, childrenCount: 1 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 1, stayPrice: 190, platformFee: SERVICE_FEE, totalPrice: 192 })
    })

    it("4 guests, 2 nights → stayPrice 230€ (75 + 2×20) × 2, totalPrice 232€", () => {
      const result = calculatePrice({ nightCount: 2, adultsCount: 1, childrenCount: 3 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 2, stayPrice: 230, platformFee: SERVICE_FEE, totalPrice: 232 })
    })

    it("4 guests, 7 nights → stayPrice 805€ (75 + 2×20) × 7, totalPrice 807€", () => {
      const result = calculatePrice({ nightCount: 7, adultsCount: 2, childrenCount: 2 })
      expect(result).toEqual({ pricePerNight: 75, pricePerExtraGuest: 20, extraGuests: 2, stayPrice: 805, platformFee: SERVICE_FEE, totalPrice: 807 })
    })
  })

  describe("extra guest surcharge applies equally to adults and children", () => {
    it("3 adults + 0 children same totalPrice as 2 adults + 1 child", () => {
      const allAdults = calculatePrice({ nightCount: 2, adultsCount: 3, childrenCount: 0 })
      const mixed = calculatePrice({ nightCount: 2, adultsCount: 2, childrenCount: 1 })
      expect(allAdults.totalPrice).toBe(mixed.totalPrice)
    })
  })

  describe("serviceFee", () => {
    it("platformFee is always SERVICE_FEE regardless of stay duration", () => {
      const oneNight = calculatePrice({ nightCount: 1, adultsCount: 1, childrenCount: 0 })
      const sevenNights = calculatePrice({ nightCount: 7, adultsCount: 1, childrenCount: 0 })
      expect(oneNight.platformFee).toBe(SERVICE_FEE)
      expect(sevenNights.platformFee).toBe(SERVICE_FEE)
    })

    it("totalPrice equals stayPrice + platformFee", () => {
      const result = calculatePrice({ nightCount: 3, adultsCount: 2, childrenCount: 1 })
      expect(result.totalPrice).toBe(result.stayPrice + result.platformFee)
    })
  })
})