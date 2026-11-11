import { asPlan, isLifetimeAccess, subscriptionGivesPro, type Plan } from "./plans"
import { allowStripeEventOnLedger, type BillingEnv } from "./env-policy"

export type PlanPatch = {
  plan?: Plan
  source?: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
  subscription_status?: string | null
  current_period_end?: string | null
}

export type ExistingPlan = {
  plan: Plan
  source: string
  stripe_customer_id?: string | null
  stripe_subscription_id?: string | null
}

export type StripeLikeEvent = {
  id?: string
  type: string
  livemode?: boolean
  data?: { object?: Record<string, unknown> }
}

export type WebhookDecision =
  | { action: "reject"; status: number; error: string }
  | { action: "ignore"; reason: string; eventId: string | null }
  | { action: "apply"; eventId: string | null; userId: string; patch: PlanPatch }

const str = (value: unknown) => (typeof value === "string" && value ? value : null)

function periodEnd(obj: Record<string, unknown>): string | null {
  const item = ((obj.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? [])[0]
  const endSec = typeof obj.current_period_end === "number" ? obj.current_period_end : typeof item?.current_period_end === "number" ? item.current_period_end : null
  return endSec ? new Date(endSec * 1000).toISOString() : null
}

/** Une un parche de Stripe con el plan actual sin degradar un Pro vitalicio o early_access. */
export function mergePlanPatch(existing: ExistingPlan | null, patch: PlanPatch): PlanPatch {
  if (!existing || !isLifetimeAccess(existing.plan, existing.source)) return patch
  const next: PlanPatch = { ...patch }
  // Conserva plan y fuente vitalicios aunque la suscripción se cancele o no se pague.
  delete next.plan
  delete next.source
  return next
}

export function decideStripeWebhook(event: StripeLikeEvent | null, env: BillingEnv = process.env): WebhookDecision {
  if (!event || typeof event.type !== "string") return { action: "reject", status: 400, error: "Evento no válido" }
  const eventId = str(event.id)
  const allowed = allowStripeEventOnLedger(event.livemode, env)
  if (!allowed.apply) return { action: "ignore", reason: allowed.reason ?? "evento ignorado", eventId }

  const obj = event.data?.object ?? {}
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    if (obj.payment_status === "unpaid") return { action: "ignore", reason: "pago no completado", eventId }
    const userId = str(obj.client_reference_id) ?? str((obj.metadata as Record<string, unknown> | undefined)?.user_id)
    if (!userId) return { action: "ignore", reason: "sin usuario", eventId }
    const lifetime = obj.mode === "payment"
    return {
      action: "apply",
      eventId,
      userId,
      patch: {
        plan: lifetime ? "founder" : "pro",
        source: "stripe",
        stripe_customer_id: str(obj.customer),
        stripe_subscription_id: lifetime ? null : str(obj.subscription),
        subscription_status: lifetime ? "paid" : "active",
      },
    }
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const userId = str((obj.metadata as Record<string, unknown> | undefined)?.user_id)
    if (!userId) return { action: "ignore", reason: "sin usuario", eventId }
    const status = event.type === "customer.subscription.deleted" ? "canceled" : str(obj.status)
    const paid = event.type !== "customer.subscription.deleted" && subscriptionGivesPro(status)
    return {
      action: "apply",
      eventId,
      userId,
      patch: {
        plan: paid ? "pro" : "free",
        source: "stripe",
        stripe_customer_id: str(obj.customer),
        stripe_subscription_id: str(obj.id),
        subscription_status: status,
        current_period_end: periodEnd(obj),
      },
    }
  }

  if (event.type === "checkout.session.async_payment_failed") {
    return { action: "ignore", reason: "pago no completado", eventId }
  }

  return { action: "ignore", reason: "tipo no gestionado", eventId }
}

export function asExistingPlan(row: { plan: unknown; source: unknown } | null): ExistingPlan | null {
  if (!row) return null
  return { plan: asPlan(row.plan), source: typeof row.source === "string" ? row.source : "stripe" }
}
