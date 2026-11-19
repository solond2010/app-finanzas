// Reglas del portal de facturación de Stripe. Sin claves ni llamadas a la red:
// el servidor las usa para decidir si puede abrir el portal, y los tests cubren
// los casos sin tocar suscripciones reales.

import { asPlan, isLifetimeAccess, subscriptionGivesPro } from "./plans"

export type PortalPlanInput = {
  plan?: string | null
  source?: string | null
  subscription_status?: string | null
  cancel_at_period_end?: boolean | null
  stripe_customer_id?: string | null
}

export type PortalDecision =
  | { ok: true; customerId: string }
  | { ok: false; status: number; error: string }

/** Solo el Pro mensual de Stripe (activo o cancelado a fin de periodo). */
export function canManageStripeSubscription(input: PortalPlanInput | null | undefined): boolean {
  if (!input?.stripe_customer_id) return false
  if ((input.source ?? "") !== "stripe") return false
  const plan = asPlan(input.plan)
  if (plan === "founder" || isLifetimeAccess(plan, input.source)) return false
  return subscriptionGivesPro(input.subscription_status)
}

/**
 * El cliente no elige el customer de Stripe: solo se usa el de la fila del
 * usuario autenticado. Si no hay suscripción gestionable, no se crea sesión.
 */
export function decideBillingPortal(input: {
  authenticated: boolean
  paymentsEnabled: boolean
  row: PortalPlanInput | null | undefined
}): PortalDecision {
  if (!input.authenticated) return { ok: false, status: 401, error: "Inicia sesión para continuar" }
  if (!input.paymentsEnabled) return { ok: false, status: 404, error: "Los pagos aún no están activos" }
  if (!canManageStripeSubscription(input.row) || !input.row?.stripe_customer_id) {
    return { ok: false, status: 409, error: "No tienes una suscripción que gestionar" }
  }
  return { ok: true, customerId: input.row.stripe_customer_id }
}

/** Texto de la tarjeta cuando el mensual ya está cancelado a fin de periodo. */
export function formatProUntil(iso: string | null | undefined, timeZone = "Europe/Madrid"): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", timeZone }).formatToParts(date)
  const day = parts.find((part) => part.type === "day")?.value
  const month = parts.find((part) => part.type === "month")?.value
  if (!day || !month) return null
  return `Pro hasta el ${day.padStart(2, "0")}/${month.padStart(2, "0")}`
}

export const GARRA_PORTAL_METADATA = "garra_customer_portal"

export type PortalConfigurationLike = {
  id?: string
  active?: boolean
  metadata?: Record<string, string | null | undefined> | null
  features?: {
    invoice_history?: { enabled?: boolean } | null
    payment_method_update?: { enabled?: boolean } | null
    subscription_cancel?: { enabled?: boolean; mode?: string | null } | null
    subscription_update?: { enabled?: boolean } | null
  } | null
}

/** Cancelar a fin de periodo, método de pago y facturas; sin cambio de plan. */
export function isCompatiblePortalConfiguration(config: PortalConfigurationLike | null | undefined): boolean {
  if (!config || config.active === false) return false
  const features = config.features
  if (!features?.invoice_history?.enabled) return false
  if (!features?.payment_method_update?.enabled) return false
  if (!features?.subscription_cancel?.enabled) return false
  if ((features.subscription_cancel.mode ?? "at_period_end") !== "at_period_end") return false
  if (features.subscription_update?.enabled) return false
  return true
}

export function pickPortalConfiguration(configs: PortalConfigurationLike[]): string | null {
  const ours = configs.find((config) => isCompatiblePortalConfiguration(config) && config.metadata?.app === GARRA_PORTAL_METADATA)
  return ours?.id ?? null
}
