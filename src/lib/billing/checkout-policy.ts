import { isPaid, normalizeCheckoutOption, type CheckoutOption, type Plan } from "./plans"

export type CheckoutDecision =
  | { ok: true; option: CheckoutOption }
  | { ok: false; status: number; error: string }

/**
 * El servidor decide el plan y el importe. Del cliente solo se acepta la
 * opción de checkout; se ignoran amount, price, price_id y currency.
 */
export function decideCheckout(input: {
  authenticated: boolean
  body: unknown
  currentPlan: Plan | null
}): CheckoutDecision {
  if (!input.authenticated) return { ok: false, status: 401, error: "Inicia sesión para continuar" }
  const body = input.body && typeof input.body === "object" ? (input.body as Record<string, unknown>) : null
  const option = normalizeCheckoutOption(body?.option)
  if (!option) return { ok: false, status: 400, error: "Elige un plan" }
  if (input.currentPlan && isPaid(input.currentPlan)) return { ok: false, status: 409, error: "Ya tienes Garra Pro" }
  return { ok: true, option }
}
