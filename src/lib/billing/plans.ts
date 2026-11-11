// Planes de Garra. Todo esto solo limita algo cuando PAYMENTS_ENABLED="true";
// mientras el interruptor esté apagado, todo el mundo tiene acceso completo.
// Oferta actual: Pro 1,99 €/mes o 14,99 € pago único vitalicio. El plan anual
// dejó de ofrecerse; un derecho Pro ya concedido no se revoca por eso.

export type Plan = "free" | "pro" | "founder"
export type CheckoutOption = "pro_monthly" | "pro_lifetime"
/** Alias histórico del pago único; se acepta en checkout por compatibilidad. */
export type LegacyCheckoutOption = "founder"

export const FREE_MAX_ACCOUNTS = 3
export const FIRST_FIFTY_LIMIT = 50

export const PRICES_EUR: Record<CheckoutOption, number> = { pro_monthly: 1.99, pro_lifetime: 14.99 }

export type PlanSource = "early_access" | "first_fifty" | "manual" | "stripe"

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

/** Fuentes o planes que son Pro de por vida y no se degradan por un evento de Stripe. */
export function isLifetimeAccess(plan: Plan | null | undefined, source: string | null | undefined): boolean {
  if (plan === "founder") return true
  return source === "early_access" || source === "first_fifty" || source === "manual"
}

/** Lo que puede usar el usuario. Con los pagos apagados: todo. */
export function entitlementsFor(plan: Plan, paymentsEnabled: boolean, source?: string | null): Entitlements {
  if (!paymentsEnabled || isPaid(plan) || isLifetimeAccess(plan, source)) return FULL
  return FREE
}

/** ¿Puede tener `nextCount` cuentas? Nunca borra las que ya existen. */
export function canHaveAccounts(plan: Plan, paymentsEnabled: boolean, nextCount: number): boolean {
  const max = entitlementsFor(plan, paymentsEnabled).maxAccounts
  return max === null || nextCount <= max
}

export function normalizeCheckoutOption(value: unknown): CheckoutOption | null {
  if (value === "pro_monthly") return "pro_monthly"
  if (value === "pro_lifetime" || value === "founder") return "pro_lifetime"
  return null
}

export function isCheckoutOption(value: unknown): value is CheckoutOption | LegacyCheckoutOption {
  return normalizeCheckoutOption(value) !== null
}

export function asPlan(value: unknown): Plan {
  return value === "pro" || value === "founder" ? value : "free"
}

/** Estado de una suscripción de Stripe que da acceso a Pro. */
export function subscriptionGivesPro(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing" || status === "past_due"
}

export type RankedUser = { id: string; created_at: string }

/** Orden determinista de registro: created_at, y el id como desempate. No lo elige el cliente. */
export function compareRegistrationOrder(a: RankedUser, b: RankedUser): number {
  if (a.created_at < b.created_at) return -1
  if (a.created_at > b.created_at) return 1
  if (a.id < b.id) return -1
  if (a.id > b.id) return 1
  return 0
}

export function isFirstFiftyUser(userId: string, users: RankedUser[], limit = FIRST_FIFTY_LIMIT): boolean {
  return [...users].sort(compareRegistrationOrder).slice(0, limit).some((user) => user.id === userId)
}

/**
 * Qué hacer al conceder el Pro de los 50 primeros. Nunca degrada un Pro
 * o un derecho vitalicio ya existente (early_access, manual, founder, stripe de pago).
 */
export function firstFiftyGrant(existing: { plan: Plan; source: string } | null, eligible: boolean): { plan: Plan; source: string } | "keep" {
  if (!eligible) return "keep"
  if (!existing) return { plan: "pro", source: "first_fifty" }
  if (isPaid(existing.plan) || isLifetimeAccess(existing.plan, existing.source)) return "keep"
  return { plan: "pro", source: "first_fifty" }
}
