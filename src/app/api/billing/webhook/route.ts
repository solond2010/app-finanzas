import { json } from "@/lib/server/auth-helpers"
import { verifyStripeSignature } from "@/lib/billing/stripe-signature"
import { decideStripeWebhook } from "@/lib/billing/webhook-plan"
import { recordStripeEvent, saveUserPlan } from "@/lib/server/billing"

// Avisos de Stripe: activa/desactiva el plan del usuario. Solo acepta
// peticiones firmadas con STRIPE_WEBHOOK_SECRET.
// Los eventos de test nunca cambian el ledger de producción.
type StripeEvent = { id?: string; type: string; livemode?: boolean; data: { object: Record<string, unknown> } }

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return json({ error: "Webhook sin configurar" }, 503)
  const payload = await request.text()
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) return json({ error: "Firma no válida" }, 400)

  let event: StripeEvent
  try { event = JSON.parse(payload) as StripeEvent } catch { return json({ error: "JSON no válido" }, 400) }

  const decision = decideStripeWebhook(event, process.env)
  if (decision.action === "reject") return json({ error: decision.error }, decision.status)

  try {
    if (decision.action === "ignore") {
      await recordStripeEvent(decision.eventId, event.type, event.livemode === true, false, decision.reason)
      return json({ ok: true, ignored: decision.reason })
    }

    // Se aplica primero y luego se registra el evento: si el guardado falla,
    // Stripe reintenta. saveUserPlan es idempotente y no degrada vitalicios.
    await saveUserPlan(decision.userId, decision.patch)
    const recorded = await recordStripeEvent(decision.eventId, event.type, event.livemode === true, true, null)
    if (recorded.duplicate) return json({ ok: true, duplicate: true })
  } catch (error) {
    console.warn("[billing] webhook:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudo guardar" }, 500) // Stripe lo reintentará
  }
  return json({ ok: true })
}
