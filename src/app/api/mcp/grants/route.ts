import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { getOauthService } from "@/lib/oauth/server"

export const dynamic = "force-dynamic"

async function requireAccount() {
  if (!isSupabaseAuthEnabled()) return null
  return getDataContext()
}

export async function GET() {
  const ctx = await requireAccount()
  if (!ctx) return unauthorizedResponse()
  try {
    const grants = await getOauthService().listGrants(ctx.userId)
    return json({
      grants: grants.map((grant) => ({
        id: grant.id,
        name: grant.clientName,
        created_at: grant.createdAt,
        last_used_at: grant.lastUsedAt,
      })),
    })
  } catch {
    return json({ error: "No se pudieron cargar las conexiones" }, 500)
  }
}

export async function DELETE(request: Request) {
  const ctx = await requireAccount()
  if (!ctx) return unauthorizedResponse()
  const body = await readJson(request)
  const id = typeof body?.id === "string" ? body.id : ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Conexión no válida" }, 400)
  try {
    const revoked = await getOauthService().revokeGrant(ctx.userId, id)
    if (!revoked) return json({ error: "No se pudo revocar la conexión" }, 400)
    return json({ ok: true })
  } catch {
    return json({ error: "No se pudo revocar la conexión" }, 500)
  }
}
