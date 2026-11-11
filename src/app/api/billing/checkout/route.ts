import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, readJson, siteOrigin } from "@/lib/server/auth-helpers"
import { decideCheckout } from "@/lib/billing/checkout-policy"
import { getUserPlanRow, paymentsEnabled, priceIdFor, stripeKey, stripeRequest } from "@/lib/server/billing"

// Abre el pago de Stripe Checkout. Apagado salvo PAYMENTS_ENABLED="true".
// El importe y el price_id los pone siempre el servidor.
export async function POST(request: Request) {
  if (!paymentsEnabled()) return json({ error: "Los pagos aún no están activos" }, 404)
  const key = stripeKey()
  if (!key) return json({ error: "Pagos sin configurar" }, 503)
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return unauthorizedResponse()

  const body = await readJson(request)
  const row = await getUserPlanRow(ctx.userId)
  const decision = decideCheckout({ authenticated: true, body, currentPlan: row?.plan ?? "free" })
  if (!decision.ok) return json({ error: decision.error }, decision.status)

  const origin = siteOrigin(request)
  const subscription = decision.option === "pro_monthly"
  const params: Record<string, string> = {
    mode: subscription ? "subscription" : "payment",
    "line_items[0][price]": priceIdFor(decision.option),
    "line_items[0][quantity]": "1",
    success_url: `${origin}/configuracion?pago=ok`,
    cancel_url: `${origin}/configuracion?pago=cancelado`,
    client_reference_id: ctx.userId,
    "metadata[user_id]": ctx.userId,
    "metadata[option]": decision.option,
    locale: "es",
  }
  if (row?.stripe_customer_id) params.customer = row.stripe_customer_id
  else if (ctx.email) params.customer_email = ctx.email
  if (subscription) params["subscription_data[metadata][user_id]"] = ctx.userId
  else if (!row?.stripe_customer_id) params.customer_creation = "always"

  try {
    const session = await stripeRequest<{ url: string }>("checkout/sessions", params, key)
    return json({ url: session.url })
  } catch (error) {
    console.warn("[billing] checkout:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudo abrir el pago. Inténtalo de nuevo." }, 502)
  }
}
