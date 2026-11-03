import { json } from "@/lib/server/auth-helpers"
import { subscriptionGivesPro } from "@/lib/billing/plans"
import { verifyStripeSignature } from "@/lib/billing/stripe-signature"
import { getUserPlanRow, saveUserPlan } from "@/lib/server/billing"

// Avisos de Stripe: activa/desactiva el plan del usuario. Solo acepta
// peticiones firmadas con STRIPE_WEBHOOK_SECRET.
type StripeEvent = { type: string; data: { object: Record<string, unknown> } }

const str = (v: unknown) => (typeof v === "string" && v ? v : null)

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return json({ error: "Webhook sin configurar" }, 503)
  const payload = await request.text()
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) return json({ error: "Firma no válida" }, 400)

  let event: StripeEvent
  try { event = JSON.parse(payload) as StripeEvent } catch { return json({ error: "JSON no válido" }, 400) }
  const obj = event.data?.object ?? {}

  try {
    if (event.type === "checkout.session.completed" && obj.payment_status !== "unpaid") {
      const userId = str(obj.client_reference_id) ?? str((obj.metadata as Record<string, unknown> | undefined)?.user_id)
      if (!userId) return json({ ok: true, ignored: "sin usuario" })
      const founder = obj.mode === "payment"
      await saveUserPlan(userId, {
        plan: founder ? "founder" : "pro",
        source: "stripe",
        stripe_customer_id: str(obj.customer),
        stripe_subscription_id: founder ? null : str(obj.subscription),
        subscription_status: founder ? "paid" : "active",
      })
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const userId = str((obj.metadata as Record<string, unknown> | undefined)?.user_id)
      if (!userId) return json({ ok: true, ignored: "sin usuario" })
      const row = await getUserPlanRow(userId)
      // Fundadores y usuarios de antes del lanzamiento no pierden Pro nunca.
      const keeps = row?.plan === "founder" || row?.source === "early_access" || row?.source === "manual"
      const status = event.type === "customer.subscription.deleted" ? "canceled" : str(obj.status)
      const item = ((obj.items as { data?: Record<string, unknown>[] } | undefined)?.data ?? [])[0]
      const endSec = typeof obj.current_period_end === "number" ? obj.current_period_end : typeof item?.current_period_end === "number" ? item.current_period_end : null
      const end = endSec ? new Date(endSec * 1000).toISOString() : null
      await saveUserPlan(userId, {
        ...(keeps ? {} : { plan: subscriptionGivesPro(status) ? "pro" : "free", source: "stripe" }),
        stripe_customer_id: str(obj.customer) ?? row?.stripe_customer_id ?? null,
        stripe_subscription_id: str(obj.id),
        subscription_status: status,
        current_period_end: end,
      })
    }
  } catch (error) {
    console.warn("[billing] webhook:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudo guardar" }, 500) // Stripe lo reintentará
  }
  return json({ ok: true })
}
