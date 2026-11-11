import "server-only"
import { supabaseServer } from "@/lib/supabase-server"
import { asPlan, type CheckoutOption, type Plan } from "@/lib/billing/plans"
import { paymentsEnabledFor, isLiveStripeKey } from "@/lib/billing/env-policy"
import { mergePlanPatch, periodEndFromStripeObject, type PlanPatch } from "@/lib/billing/webhook-plan"

// Pagos con Stripe. Apagados salvo PAYMENTS_ENABLED="true".
// Claves: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET (nunca en el código).
// Por seguridad solo se aceptan claves de prueba (sk_test_) salvo que
// STRIPE_ALLOW_LIVE="true". En producción, una clave de test no activa el checkout.

export function paymentsEnabled(): boolean {
  return paymentsEnabledFor(process.env)
}

// Precios del entorno de prueba de Stripe (livemode=false). En vivo se
// sustituyen por STRIPE_PRICE_PRO_MONTHLY y STRIPE_PRICE_PRO_LIFETIME.
const TEST_PRICES: Record<CheckoutOption, string> = {
  pro_monthly: "price_1UafEhR66ZzTtUm81vYwDdjt", // 1,99 €/mes, test
  pro_lifetime: "price_1UXqzWR66ZzTtUm897BZdc29", // 14,99 € único, test
}

export function priceIdFor(option: CheckoutOption): string {
  const env = option === "pro_monthly"
    ? process.env.STRIPE_PRICE_PRO_MONTHLY
    : (process.env.STRIPE_PRICE_PRO_LIFETIME ?? process.env.STRIPE_PRICE_FOUNDER)
  return env || TEST_PRICES[option]
}

export function stripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (isLiveStripeKey(key) && process.env.STRIPE_ALLOW_LIVE !== "true") return null
  return key
}

async function stripeGet<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${key}` },
    cache: "no-store",
  })
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null
  if (!res.ok || !body) throw new Error(body?.error?.message ?? `Stripe respondió ${res.status}`)
  return body
}

/** Si el checkout mensual no trae el fin de periodo, lo lee de la suscripción en Stripe. */
export async function fillCheckoutPeriodEnd(patch: PlanPatch): Promise<PlanPatch> {
  if (patch.current_period_end || !patch.stripe_subscription_id) return patch
  const key = stripeKey()
  if (!key) throw new Error("Falta la clave de Stripe para obtener el fin de periodo")
  const sub = await stripeGet<Record<string, unknown>>(`subscriptions/${encodeURIComponent(patch.stripe_subscription_id)}`, key)
  const end = periodEndFromStripeObject(sub)
  if (!end) throw new Error("Stripe no devolvió el fin de periodo de la suscripción")
  return { ...patch, current_period_end: end }
}

export type UserPlanRow = { user_id: string; plan: Plan; source: string; stripe_customer_id: string | null; stripe_subscription_id: string | null; subscription_status: string | null; current_period_end: string | null }

export async function getUserPlanRow(userId: string): Promise<UserPlanRow | null> {
  const { data, error } = await supabaseServer.from("user_plans").select("*").eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return data ? { ...(data as UserPlanRow), plan: asPlan((data as UserPlanRow).plan) } : null
}

export async function getUserPlan(userId: string): Promise<Plan> {
  return (await getUserPlanRow(userId))?.plan ?? "free"
}

/** Concede Pro vitalicio si el usuario está entre los 50 primeros; no degrada derechos previos. */
export async function ensureFirstFiftyGrant(userId: string): Promise<void> {
  const { error } = await supabaseServer.rpc("grant_first_fifty_if_eligible", { p_user_id: userId })
  if (error) throw new Error(error.message)
}

export async function saveUserPlan(userId: string, patch: PlanPatch) {
  const existing = await getUserPlanRow(userId)
  const merged = mergePlanPatch(existing, patch)
  const { error } = await supabaseServer.from("user_plans").upsert({ user_id: userId, ...merged, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) throw new Error(error.message)
}

export async function recordStripeEvent(eventId: string | null, eventType: string, livemode: boolean, applied: boolean, ignoredReason: string | null) {
  if (!eventId) return { duplicate: false }
  const { data: existing, error: readError } = await supabaseServer.from("stripe_webhook_events").select("event_id").eq("event_id", eventId).maybeSingle()
  if (readError) {
    if (/stripe_webhook_events|schema cache|does not exist/i.test(readError.message)) return { duplicate: false }
    throw new Error(readError.message)
  }
  if (existing) return { duplicate: true }
  const { error } = await supabaseServer.from("stripe_webhook_events").insert({ event_id: eventId, event_type: eventType, livemode, applied, ignored_reason: ignoredReason })
  if (error && /duplicate|unique/i.test(error.message)) return { duplicate: true }
  if (error && /stripe_webhook_events|schema cache|does not exist/i.test(error.message)) return { duplicate: false }
  if (error) throw new Error(error.message)
  return { duplicate: false }
}

/** Llamada a la API de Stripe (form-urlencoded), sin dependencias extra. */
export async function stripeRequest<T>(path: string, params: Record<string, string>, key: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    cache: "no-store",
  })
  const body = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null
  if (!res.ok || !body) throw new Error(body?.error?.message ?? `Stripe respondió ${res.status}`)
  return body
}
