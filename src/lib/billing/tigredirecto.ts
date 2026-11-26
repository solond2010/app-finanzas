// Código TIGREDIRECTO: 5 € de descuento solo en el Pro vitalicio.
// Lo valida el servidor (sin distinguir mayúsculas ni espacios) y lo aplica
// en Checkout con discounts[]. Nunca se usa allow_promotion_codes, porque el
// producto se comparte con el mensual y Stripe no lo combina con discounts.
// Durante el Black Friday el vitalicio ya está a 9,99 €: no se acumulan cupones.

import { checkoutCouponParams, isBlackFridayLifetimeActive } from "./black-friday"
import type { CheckoutOption } from "./plans"

export const TIGRE_DIRECTO_COUPON_ID = "TIGREDIRECTO"
export const TIGRE_DIRECTO_OFF_EUR = 5
export const TIGRE_DIRECTO_INVALID = "Ese código no es válido."
export const TIGRE_DIRECTO_MONTHLY = "Este código solo vale para el Pro de por vida."

export function normalizePromoCode(value: string): string {
  return value.replace(/\s+/g, "").toLocaleUpperCase("es")
}

export type PromoCodeParse =
  | { ok: true; couponId: typeof TIGRE_DIRECTO_COUPON_ID }
  | { ok: true; empty: true }
  | { ok: false; error: string }

export function parseLifetimePromoCode(value: unknown): PromoCodeParse {
  if (value === undefined || value === null || value === "") return { ok: true, empty: true }
  if (typeof value !== "string") return { ok: false, error: TIGRE_DIRECTO_INVALID }
  const normalized = normalizePromoCode(value)
  if (!normalized) return { ok: true, empty: true }
  if (normalized === TIGRE_DIRECTO_COUPON_ID) return { ok: true, couponId: TIGRE_DIRECTO_COUPON_ID }
  return { ok: false, error: TIGRE_DIRECTO_INVALID }
}

function hasCoupon(parsed: PromoCodeParse): parsed is { ok: true; couponId: typeof TIGRE_DIRECTO_COUPON_ID } {
  return parsed.ok && "couponId" in parsed
}

export type CheckoutPromoResult =
  | { ok: true; params: Record<string, string>; couponId: string | null }
  | { ok: false; error: string }

/**
 * Cupón que debe llevar la Checkout Session. Vacío si no hay código y no hay
 * oferta Black Friday. Rechaza un código en el mensual y un texto que no sea
 * TIGREDIRECTO. En la ventana Black Friday aplica solo BLACKFRIDAY.
 */
export function checkoutPromoCouponParams(
  option: CheckoutOption,
  code: unknown,
  now: Date | number = Date.now(),
): CheckoutPromoResult {
  const parsed = parseLifetimePromoCode(code)
  if (!parsed.ok) return parsed

  if (option !== "pro_lifetime") {
    if (hasCoupon(parsed)) return { ok: false, error: TIGRE_DIRECTO_MONTHLY }
    return { ok: true, params: {}, couponId: null }
  }

  if (isBlackFridayLifetimeActive(now)) {
    const params = checkoutCouponParams(option, now)
    return { ok: true, params, couponId: params["discounts[0][coupon]"] ?? null }
  }

  if (!hasCoupon(parsed)) return { ok: true, params: {}, couponId: null }
  return { ok: true, params: { "discounts[0][coupon]": TIGRE_DIRECTO_COUPON_ID }, couponId: TIGRE_DIRECTO_COUPON_ID }
}
