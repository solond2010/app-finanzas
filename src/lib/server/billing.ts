import "server-only"
import { supabaseServer } from "@/lib/supabase-server"
import { asPlan, FOUNDER_SPOTS, type CheckoutOption, type Plan } from "@/lib/billing/plans"

// Pagos con Stripe. Apagados salvo PAYMENTS_ENABLED="true".
// Claves: STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET (nunca en el código).
// Por seguridad solo se aceptan claves de prueba (sk_test_) salvo que
// STRIPE_ALLOW_LIVE="true".

export function paymentsEnabled(): boolean {
  return process.env.PAYMENTS_ENABLED === "true"
}

// Precios del entorno de prueba de Stripe; en real se cambian por variables.
const TEST_PRICES: Record<CheckoutOption, string> = {
  pro_monthly: "price_1UXqzOR66ZzTtUm8xsg4N2SV",
  pro_yearly: "price_1UXqzTR66ZzTtUm8KQhSbU6a",
  founder: "price_1UXqzWR66ZzTtUm897BZdc29",
}

export function priceIdFor(option: CheckoutOption): string {
  const env = { pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY, pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY, founder: process.env.STRIPE_PRICE_FOUNDER }[option]
  return env || TEST_PRICES[option]
}

export function stripeKey(): string | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (key.startsWith("sk_live_") && process.env.STRIPE_ALLOW_LIVE !== "true") return null
  return key
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

export async function founderCount(): Promise<number> {
  const { data, error } = await supabaseServer.rpc("founder_count")
  if (error) throw new Error(error.message)
  return Number(data) || 0
}

export async function founderSpotsLeft(): Promise<number> {
  return Math.max(0, FOUNDER_SPOTS - (await founderCount()))
}

export async function saveUserPlan(userId: string, patch: Partial<Omit<UserPlanRow, "user_id">>) {
  const { error } = await supabaseServer.from("user_plans").upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
  if (error) throw new Error(error.message)
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
