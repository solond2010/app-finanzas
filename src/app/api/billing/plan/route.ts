import { getDataContext } from "@/lib/server/request-context"
import { json } from "@/lib/server/auth-helpers"
import { publicLifetimeOffer } from "@/lib/billing/black-friday"
import { entitlementsFor, isLifetimeAccess, PRICES_EUR } from "@/lib/billing/plans"
import { canManageStripeSubscription } from "@/lib/billing/portal-policy"
import { shouldOfferMonthlyTrial } from "@/lib/billing/monthly-trial"
import { userCanUseConnectors } from "@/lib/server/connectors-access"
import { ensureFirstFiftyGrant, getUserPlanRow, paymentsEnabled } from "@/lib/server/billing"

export const dynamic = "force-dynamic"

// Plan del usuario. Con los pagos apagados solo dice { enabled: false } y la
// app no muestra nada de planes ni limita nada.
export async function GET() {
  if (!paymentsEnabled()) return json({ enabled: false })
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return json({ enabled: false })
  try {
    await ensureFirstFiftyGrant(ctx.userId)
    const row = await getUserPlanRow(ctx.userId)
    const plan = row?.plan ?? "free"
    const source = row?.source ?? null
    return json({
      enabled: true,
      plan,
      source,
      lifetime: isLifetimeAccess(plan, source),
      renews: row?.current_period_end ?? null,
      cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end) && canManageStripeSubscription(row),
      canManageSubscription: canManageStripeSubscription(row),
      offerMonthlyTrial: shouldOfferMonthlyTrial(row),
      trialing: row?.subscription_status === "trialing",
      entitlements: entitlementsFor(plan, true, source),
      prices: PRICES_EUR,
      lifetimeOffer: publicLifetimeOffer(),
      connectorsAccess: await userCanUseConnectors(ctx.userId),
    })
  } catch (error) {
    console.warn("[billing] plan:", error instanceof Error ? error.message : error)
    return json({ enabled: false })
  }
}
