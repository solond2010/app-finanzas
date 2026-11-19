import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, siteOrigin } from "@/lib/server/auth-helpers"
import { decideBillingPortal } from "@/lib/billing/portal-policy"
import { createBillingPortalSession, getUserPlanRow, paymentsEnabled, stripeKey } from "@/lib/server/billing"

// Abre el portal de facturación de Stripe del propio usuario. Nunca acepta
// un customer_id del cliente. Apagado si los pagos no están activos.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!paymentsEnabled()) return json({ error: "Los pagos aún no están activos" }, 404)
  const key = stripeKey()
  if (!key) return json({ error: "Pagos sin configurar" }, 503)
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return unauthorizedResponse()

  let row
  try {
    row = await getUserPlanRow(ctx.userId)
  } catch (error) {
    console.warn("[billing] portal: no se pudo leer el plan:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudo abrir la suscripción. Inténtalo de nuevo." }, 500)
  }

  const decision = decideBillingPortal({ authenticated: true, paymentsEnabled: true, row })
  if (!decision.ok) return json({ error: decision.error }, decision.status)

  try {
    const session = await createBillingPortalSession(key, decision.customerId, `${siteOrigin(request)}/configuracion`)
    return json({ url: session.url })
  } catch (error) {
    console.warn("[billing] portal:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudo abrir la suscripción. Inténtalo de nuevo." }, 502)
  }
}
