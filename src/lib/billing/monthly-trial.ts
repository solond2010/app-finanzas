// Primer mes gratis del Pro mensual (prueba de Stripe Checkout, 30 días).
// El cobro de PRICES_EUR.pro_monthly empieza en el 2.º mes. No se ofrece
// de nuevo si el usuario ya tuvo una suscripción o un trial, ni a vitalicios.

import { asPlan, isLifetimeAccess, isPaid, PRICES_EUR, type Plan } from "./plans"

export const MONTHLY_TRIAL_DAYS = 30

export const MONTHLY_TRIAL_BADGE = "Primer mes gratis"

export function monthlyTrialPriceLabel(): string {
  return PRICES_EUR.pro_monthly.toLocaleString("es-ES", { style: "currency", currency: "EUR" })
}

export function monthlyTrialNote(): string {
  return `El primer mes es gratis. A partir del 2.º mes se cobra ${monthlyTrialPriceLabel()} al mes. Cancela cuando quieras.`
}

export function monthlyTrialCheckoutMessage(): string {
  return `El primer mes es gratis. A partir del 2.º mes se cobra ${monthlyTrialPriceLabel()} al mes. Puedes cancelar cuando quieras.`
}

export const MONTHLY_NOTE_WITHOUT_TRIAL = "Se renueva cada mes. Cancela cuando quieras."

export type TrialEligibilityInput = {
  plan?: Plan | string | null
  source?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  hadPriorStripeSubscription?: boolean
}

/** Una suscripción real o un trial ya empezado; no cuenta un checkout a medias. */
export function countsAsPriorSubscription(status: string | null | undefined): boolean {
  if (!status || status === "incomplete") return false
  return true
}

export function alreadyUsedMonthlyTrial(input: TrialEligibilityInput | null | undefined): boolean {
  if (!input) return false
  if (input.stripe_subscription_id) return true
  if (input.hadPriorStripeSubscription) return true
  return countsAsPriorSubscription(input.subscription_status)
}

/** Quién puede ver y usar el mes de prueba. Los vitalicios nunca. */
export function shouldOfferMonthlyTrial(input: TrialEligibilityInput | null | undefined): boolean {
  if (!input) return true
  const plan = asPlan(input.plan)
  if (isPaid(plan) || isLifetimeAccess(plan, input.source)) return false
  return !alreadyUsedMonthlyTrial(input)
}

export function monthlySubscriptionCheckoutParams(offerTrial: boolean): Record<string, string> {
  const params: Record<string, string> = { payment_method_collection: "always" }
  if (!offerTrial) return params
  return {
    ...params,
    "subscription_data[trial_period_days]": String(MONTHLY_TRIAL_DAYS),
    "custom_text[submit][message]": monthlyTrialCheckoutMessage(),
  }
}

/** Estado que guarda el ledger tras un checkout mensual. */
export function monthlyStatusFromCheckout(obj: Record<string, unknown>): string {
  const subscription = obj.subscription
  const expanded = subscription && typeof subscription === "object" ? (subscription as Record<string, unknown>) : null
  const status = typeof expanded?.status === "string" && expanded.status ? expanded.status : null
  if (status) return status
  if (obj.payment_status === "no_payment_required") return "trialing"
  return "active"
}
