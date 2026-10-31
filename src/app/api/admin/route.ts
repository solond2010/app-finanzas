import { getDataContext } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"
import { isAdminUserId } from "@/lib/auth-mode"

// Sección oculta de administración: comentarios y errores recientes. Solo
// para Moha (isAdminUserId). A cualquier otro usuario le responde 404, como
// si no existiera; además Postgres solo deja leer estas tablas a app_admins.
const notFound = () => json({ error: "No encontrado" }, 404)

export async function GET() {
  const ctx = await getDataContext()
  if (!ctx || !isAdminUserId(ctx.userId)) return notFound()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [feedback, errors, errors24h] = await Promise.all([
    ctx.db.from("feedback").select("id, kind, message, page, email, user_agent, status, created_at").order("created_at", { ascending: false }).limit(100),
    ctx.db.from("app_errors").select("id, source, route, message, stack, digest, user_agent, user_id, created_at").order("created_at", { ascending: false }).limit(100),
    ctx.db.from("app_errors").select("id", { count: "exact", head: true }).gte("created_at", since),
  ])
  if (feedback.error || errors.error) return json({ error: "Las tablas de la beta aún no están activadas" }, 503)
  return json({ feedback: feedback.data ?? [], errors: errors.data ?? [], errors24h: errors24h.count ?? 0 })
}

export async function PATCH(request: Request) {
  const ctx = await getDataContext()
  if (!ctx || !isAdminUserId(ctx.userId)) return notFound()
  const body = await readJson(request)
  const id = typeof body?.id === "string" ? body.id : ""
  const status = body?.status === "nuevo" || body?.status === "visto" || body?.status === "hecho" ? body.status : null
  if (!/^[0-9a-f-]{36}$/i.test(id) || !status) return json({ error: "Datos no válidos" }, 400)
  const { error } = await ctx.db.from("feedback").update({ status }).eq("id", id)
  if (error) return json({ error: "No se pudo actualizar" }, 500)
  return json({ ok: true })
}
