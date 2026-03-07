export type PricingInput = {
  nightCount: number
  adultsCount: number
  childrenCount: number
}

export type PricingResult = {
  pricePerNight: number
  pricePerExtraGuest: number
  extraGuests: number
  totalPrice: number
}

export function calculatePrice({ nightCount, adultsCount, childrenCount }: PricingInput): PricingResult {
  const pricePerNight = nightCount === 1 ? 80 : 75
  const pricePerExtraGuest = 20
  const extraGuests = Math.max(0, adultsCount + childrenCount - 2)
  const totalPrice = (pricePerNight + extraGuests * pricePerExtraGuest) * nightCount

  return { pricePerNight, pricePerExtraGuest, extraGuests, totalPrice }
}