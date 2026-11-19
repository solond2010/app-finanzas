import { json, readJson } from "@/lib/server/auth-helpers"
import { requireAdmin } from "@/lib/server/require-admin"
import { supabaseServer } from "@/lib/supabase-server"
import { getUserPlanRow } from "@/lib/server/billing"
import {
  adminPlanKind,
  adminProCapabilities,
  decideAdminProChange,
  isUserUuid,
} from "@/lib/admin-users"

// Otorgar o quitar Pro de por vida. Solo el admin. La clave de servicio
// queda en el servidor; a cualquier otro usuario le responde 404, como
// el resto de /api/admin.

const notFound = () => json({ error: "No encontrado" }, 404)

export async function POST(request: Request) {
  const ctx = await requireAdmin()
  if (!ctx) return notFound()

  const body = await readJson(request)
  const userId = typeof body?.userId === "string" ? body.userId.trim() : ""
  const action = body?.action === "grant" || body?.action === "revoke" ? body.action : null
  if (!isUserUuid(userId) || !action) {
    return json({ error: "Petición no válida" }, 400)
  }

  const { data: authData, error: authError } = await supabaseServer.auth.admin.getUserById(userId)
  if (authError || !authData?.user) return json({ error: "Usuario no encontrado" }, 404)

  let existing
  try {
    existing = await getUserPlanRow(userId)
  } catch (error) {
    console.warn("[admin] no se pudo leer el plan:", error instanceof Error ? error.message : error)
    return json({ error: "No se pudo actualizar el plan" }, 500)
  }

  const decision = decideAdminProChange(existing, action)
  if (!decision.ok) return json({ error: decision.error }, 409)

  const { error } = await supabaseServer.from("user_plans").upsert({
    user_id: userId,
    plan: decision.plan,
    source: decision.source,
    stripe_customer_id: existing?.stripe_customer_id ?? null,
    stripe_subscription_id: existing?.stripe_subscription_id ?? null,
    subscription_status: existing?.subscription_status ?? null,
    current_period_end: existing?.current_period_end ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" })

  if (error) {
    console.warn("[admin] no se pudo guardar el plan:", error.message)
    return json({ error: "No se pudo actualizar el plan" }, 500)
  }

  const caps = adminProCapabilities({ plan: decision.plan, source: decision.source })
  return json({
    ok: true,
    user: { id: userId, plan: adminPlanKind({ plan: decision.plan, source: decision.source }), ...caps },
  })
}
