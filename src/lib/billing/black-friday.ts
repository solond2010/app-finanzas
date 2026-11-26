// Oferta flash Black Friday 2026: 5 € de descuento en el Pro vitalicio.
// El servidor solo aplica el cupón de Stripe dentro de esta ventana;
// fuera de ella el precio vuelve solo a PRICES_EUR.pro_lifetime.
// Checkout no combina discounts[] y allow_promotion_codes: priorizamos
// el descuento automático. No hay código que el cliente tenga que escribir.

import { PRICES_EUR, type CheckoutOption } from "./plans"

/** Id del cupón en Stripe (test y live). Hay que crearlo antes de la oferta. */
export const BLACK_FRIDAY_COUPON_ID = "BLACKFRIDAY"

/** Descuento fijo en euros sobre el precio de lista del vitalicio. */
export const BLACK_FRIDAY_OFF_EUR = 5

export const BLACK_FRIDAY_NOTICE = "Oferta Black Friday · hasta el lunes 30 nov, 23:59"

/** Jueves 26 nov 2026 21:00, hora de Madrid (UTC+1). */
export const BLACK_FRIDAY_START_UTC = "2026-11-26T20:00:00.000Z"

/** Fin exclusivo: martes 1 dic 2026 00:00, hora de Madrid. Incluye el lunes 30 nov 23:59. */
export const BLACK_FRIDAY_END_UTC = "2026-11-30T23:00:00.000Z"

/** redeem_by del cupón en Stripe: último instante de la oferta (30 nov 23:00 UTC). */
export const BLACK_FRIDAY_REDEEM_BY_UNIX = Math.floor(Date.parse(BLACK_FRIDAY_END_UTC) / 1000)

export type BlackFridayLifetimeOffer = {
  couponId: typeof BLACK_FRIDAY_COUPON_ID
  listPriceEur: number
  salePriceEur: number
  notice: string
  redeemByUnix: number
}

export type PublicLifetimeOffer = {
  listPrice: number
  salePrice: number
  notice: string
}

function at(now: Date | number): number {
  return typeof now === "number" ? now : now.getTime()
}

export function isBlackFridayLifetimeActive(now: Date | number = Date.now()): boolean {
  const t = at(now)
  return t >= Date.parse(BLACK_FRIDAY_START_UTC) && t < Date.parse(BLACK_FRIDAY_END_UTC)
}

export function blackFridayLifetimeOffer(now: Date | number = Date.now()): BlackFridayLifetimeOffer | null {
  if (!isBlackFridayLifetimeActive(now)) return null
  const listPriceEur = PRICES_EUR.pro_lifetime
  return {
    couponId: BLACK_FRIDAY_COUPON_ID,
    listPriceEur,
    salePriceEur: Number((listPriceEur - BLACK_FRIDAY_OFF_EUR).toFixed(2)),
    notice: BLACK_FRIDAY_NOTICE,
    redeemByUnix: BLACK_FRIDAY_REDEEM_BY_UNIX,
  }
}

/** Lo que puede ver el cliente: precios y aviso, sin el id del cupón. */
export function publicLifetimeOffer(now: Date | number = Date.now()): PublicLifetimeOffer | null {
  const offer = blackFridayLifetimeOffer(now)
  if (!offer) return null
  return { listPrice: offer.listPriceEur, salePrice: offer.salePriceEur, notice: offer.notice }
}

/**
 * Parámetros de Checkout Session para el descuento automático.
 * Vacío fuera de la ventana o si no es el vitalicio. Nunca incluye
 * allow_promotion_codes (Stripe no lo admite junto a discounts).
 */
export function checkoutCouponParams(option: CheckoutOption, now: Date | number = Date.now()): Record<string, string> {
  if (option !== "pro_lifetime") return {}
  const offer = blackFridayLifetimeOffer(now)
  if (!offer) return {}
  return { "discounts[0][coupon]": offer.couponId }
}
