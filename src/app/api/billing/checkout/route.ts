import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, readJson, siteOrigin } from "@/lib/server/auth-helpers"
import { isCheckoutOption, isPaid } from "@/lib/billing/plans"
import { founderSpotsLeft, getUserPlanRow, paymentsEnabled, priceIdFor, stripeKey, stripeRequest } from "@/lib/server/billing"

// Abre el pago de Stripe Checkout. Apagado salvo PAYMENTS_ENABLED="true".
export async function POST(request: Request) {
  if (!paymentsEnabled()) return json({ error: "Los pagos aún no están activos" }, 404)
  const key = stripeKey()
  if (!key) return json({ error: "Pagos sin configurar" }, 503)
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return unauthorizedResponse()

  const body = await readJson(request)
  const option = body?.option
  if (!isCheckoutOption(option)) return json({ error: "Elige un plan" }, 400)

  const row = await getUserPlanRow(ctx.userId)
  if (row && isPaid(row.plan)) return json({ error: "Ya tienes Garra Pro" }, 409)
  if (option === "founder" && (await founderSpotsLeft()) <= 0) return json({ error: "Ya no quedan plazas de Fundador" }, 409)

  const origin = siteOrigin(request)
  const subscription = option !== "founder"
  const params: Record<string, string> = {
    mode: subscription ? "subscription" : "payment",
    "line_items[0][price]": priceIdFor(option),
    "line_items[0][quantity]": "1",
    success_url: `${origin}/configuracion?pago=ok`,
    cancel_url: `${origin}/configuracion?pago=cancelado`,
    client_reference_id: ctx.userId,
    "metadata[user_id]": ctx.userId,
    "metadata[option]": option,
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
