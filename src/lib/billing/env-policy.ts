/**
 * Política de pagos y ledger. Extraída para poder probarla sin secretos.
 * En producción los eventos de test de Stripe nunca escriben user_plans.
 * Un checkout de test tampoco se muestra a los clientes de producción.
 */
export type BillingEnv = {
  PAYMENTS_ENABLED?: string
  VERCEL_ENV?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_ALLOW_LIVE?: string
  STRIPE_ALLOW_TEST_LEDGER?: string
  [key: string]: string | undefined
}

export function isProductionRuntime(env: BillingEnv = process.env): boolean {
  return env.VERCEL_ENV === "production"
}

export function isLiveStripeKey(key: string | null | undefined): boolean {
  return typeof key === "string" && key.startsWith("sk_live_")
}

export function isTestStripeKey(key: string | null | undefined): boolean {
  return typeof key === "string" && (key.startsWith("sk_test_") || key.startsWith("rk_test_"))
}

/** Interruptor de la oferta de planes/checkout. En producción, nunca con clave de test. */
export function paymentsEnabledFor(env: BillingEnv = process.env): boolean {
  if (env.PAYMENTS_ENABLED !== "true") return false
  if (isProductionRuntime(env) && isTestStripeKey(env.STRIPE_SECRET_KEY)) return false
  if (isLiveStripeKey(env.STRIPE_SECRET_KEY) && env.STRIPE_ALLOW_LIVE !== "true") return false
  return true
}

/**
 * ¿Puede un evento de Stripe aplicarse al ledger de planes de esta instancia?
 * Los eventos de test (livemode=false) no tocan el ledger en producción, ni
 * en otros entornos salvo STRIPE_ALLOW_TEST_LEDGER="true" (entorno aislado).
 */
export function allowStripeEventOnLedger(livemode: boolean | undefined, env: BillingEnv = process.env): { apply: boolean; reason?: string } {
  if (livemode === true) {
    if (env.STRIPE_ALLOW_LIVE !== "true") return { apply: false, reason: "evento live ignorado: los pagos en vivo no están autorizados" }
    return { apply: true }
  }
  if (isProductionRuntime(env)) return { apply: false, reason: "evento de test ignorado: no cambia el ledger de producción" }
  if (env.STRIPE_ALLOW_TEST_LEDGER !== "true") return { apply: false, reason: "evento de test ignorado: no hay ledger de test aislado" }
  return { apply: true }
}
