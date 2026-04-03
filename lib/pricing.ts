export const SERVICE_FEE = 2

export type PricingInput = {
  nightCount: number
  adultsCount: number
  childrenCount: number
}

export type PricingResult = {
  pricePerNight: number
  pricePerExtraGuest: number
  extraGuests: number
  stayPrice: number
  platformFee: number
  totalPrice: number
}

export function calculatePrice({ nightCount, adultsCount, childrenCount }: PricingInput): PricingResult {
  const pricePerNight = nightCount === 1 ? 80 : 75
  const pricePerExtraGuest = 20
  const extraGuests = Math.max(0, adultsCount + childrenCount - 2)
  const stayPrice = (pricePerNight + extraGuests * pricePerExtraGuest) * nightCount
  const totalPrice = stayPrice + SERVICE_FEE

  return { pricePerNight, pricePerExtraGuest, extraGuests, stayPrice, platformFee: SERVICE_FEE, totalPrice }
}