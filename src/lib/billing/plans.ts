// Planes de Garra. Todo esto solo limita algo cuando PAYMENTS_ENABLED="true";
// mientras el interruptor esté apagado, todo el mundo tiene acceso completo.

export type Plan = "free" | "pro" | "founder"
export type CheckoutOption = "pro_monthly" | "pro_yearly" | "founder"

export const FREE_MAX_ACCOUNTS = 3
export const FOUNDER_SPOTS = 50

export const PRICES_EUR: Record<CheckoutOption, number> = { pro_monthly: 3.99, pro_yearly: 29.99, founder: 14.99 }

export type Entitlements = {
  maxAccounts: number | null // null = sin límite
  investments: boolean
  netWorthHistory: boolean
  advancedAnalytics: boolean
  export: boolean
}

const FULL: Entitlements = { maxAccounts: null, investments: true, netWorthHistory: true, advancedAnalytics: true, export: true }
const FREE: Entitlements = { maxAccounts: FREE_MAX_ACCOUNTS, investments: false, netWorthHistory: false, advancedAnalytics: false, export: false }

export function isPaid(plan: Plan): boolean {
  return plan === "pro" || plan === "founder"
}

/** Lo que puede usar el usuario. Con los pagos apagados: todo. */
export function entitlementsFor(plan: Plan, paymentsEnabled: boolean): Entitlements {
  if (!paymentsEnabled || isPaid(plan)) return FULL
  return FREE
}

/** ¿Puede tener `nextCount` cuentas? */
export function canHaveAccounts(plan: Plan, paymentsEnabled: boolean, nextCount: number): boolean {
  const max = entitlementsFor(plan, paymentsEnabled).maxAccounts
  return max === null || nextCount <= max
}

export function isCheckoutOption(value: unknown): value is CheckoutOption {
  return value === "pro_monthly" || value === "pro_yearly" || value === "founder"
}

export function asPlan(value: unknown): Plan {
  return value === "pro" || value === "founder" ? value : "free"
}

/** Estado de una suscripción de Stripe que da acceso a Pro. */
export function subscriptionGivesPro(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due"
}
