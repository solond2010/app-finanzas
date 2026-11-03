import { getDataContext } from "@/lib/server/request-context"
import { json } from "@/lib/server/auth-helpers"
import { entitlementsFor } from "@/lib/billing/plans"
import { founderSpotsLeft, getUserPlanRow, paymentsEnabled } from "@/lib/server/billing"

export const dynamic = "force-dynamic"

// Plan del usuario. Con los pagos apagados solo dice { enabled: false } y la
// app no muestra nada de planes ni limita nada.
export async function GET() {
  if (!paymentsEnabled()) return json({ enabled: false })
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return json({ enabled: false })
  try {
    const row = await getUserPlanRow(ctx.userId)
    const plan = row?.plan ?? "free"
    return json({ enabled: true, plan, source: row?.source ?? null, renews: row?.current_period_end ?? null, entitlements: entitlementsFor(plan, true), founderSpotsLeft: await founderSpotsLeft() })
  } catch (error) {
    console.warn("[billing] plan:", error instanceof Error ? error.message : error)
    return json({ enabled: false })
  }
}
