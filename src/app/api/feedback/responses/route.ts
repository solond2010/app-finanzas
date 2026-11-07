import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"

const UUID = /^[0-9a-f-]{36}$/i

/** Respuestas privadas a comentarios pertenecientes al usuario autenticado. */
export async function GET() {
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return unauthorizedResponse()

  const { data, error } = await ctx.db
    .from("feedback_replies")
    .select("id, feedback_id, message, created_at, read_at")
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return json({ error: "No se pudieron cargar las respuestas" }, 503)
  return json({ responses: data ?? [] })
}

/** Marca como leídas solo respuestas que pertenecen a la sesión actual. */
export async function PATCH(request: Request) {
  const ctx = await getDataContext().catch(() => null)
  if (!ctx) return unauthorizedResponse()

  const body = await readJson(request)
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === "string" && UUID.test(id)).slice(0, 50) : []
  if (ids.length === 0) return json({ error: "No hay notificaciones válidas" }, 400)

  const { error } = await ctx.db
    .from("feedback_replies")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .in("id", ids)
    .is("read_at", null)

  if (error) return json({ error: "No se pudieron marcar como leídas" }, 503)
  return json({ ok: true })
}
