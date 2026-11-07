import { getDataContext } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"
import { isAdminUserId } from "@/lib/auth-mode"
import { isIgnorableClientError } from "@/lib/error-report"

// Sección oculta de administración: comentarios y errores recientes. Solo
// para Moha (isAdminUserId). A cualquier otro usuario le responde 404, como
// si no existiera; además Postgres solo deja leer estas tablas a app_admins.
const notFound = () => json({ error: "No encontrado" }, 404)

export async function GET() {
  const ctx = await getDataContext()
  if (!ctx || !isAdminUserId(ctx.userId)) return notFound()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const [feedback, errors, errors24h] = await Promise.all([
    ctx.db.from("feedback").select("id, user_id, kind, message, page, email, user_agent, status, created_at").order("created_at", { ascending: false }).limit(100),
    ctx.db.from("app_errors").select("id, source, route, message, stack, digest, user_agent, user_id, created_at").order("created_at", { ascending: false }).limit(100),
    ctx.db.from("app_errors").select("id", { count: "exact", head: true }).gte("created_at", since),
  ])
  if (feedback.error || errors.error) return json({ error: "Las tablas de la beta aún no están activadas" }, 503)
  // Fuera el ruido de extensiones que ya estuviera guardado de antes.
  const noise = (e: { message?: string | null; stack?: string | null }) => isIgnorableClientError(e.message ?? "") || isIgnorableClientError(e.stack ?? "")
  const allErrors = errors.data ?? []
  const realErrors = allErrors.filter((e) => !noise(e))
  const recentNoise = allErrors.filter((e) => e.created_at >= since && noise(e)).length
  return json({ feedback: feedback.data ?? [], errors: realErrors, errors24h: Math.max(0, (errors24h.count ?? 0) - recentNoise), hiddenNoise: allErrors.length - realErrors.length })
}

export async function PATCH(request: Request) {
  const ctx = await getDataContext()
  if (!ctx || !isAdminUserId(ctx.userId)) return notFound()
  const body = await readJson(request)
  const id = typeof body?.id === "string" ? body.id : ""
  const status = body?.status === "nuevo" || body?.status === "visto" || body?.status === "hecho" ? body.status : null
  if (!/^[0-9a-f-]{36}$/i.test(id) || !status) return json({ error: "Datos no válidos" }, 400)

  const reply = typeof body?.message === "string" ? body.message.trim() : ""
  if (reply.length > 0) {
    if (status !== "hecho" || reply.length < 3 || reply.length > 2000) return json({ error: "La respuesta debe tener entre 3 y 2000 caracteres" }, 400)
    const { data: feedback, error: feedbackError } = await ctx.db.from("feedback").select("id, user_id").eq("id", id).maybeSingle()
    if (feedbackError || !feedback) return json({ error: "No se encontró el comentario" }, 404)
    if (!feedback.user_id) return json({ error: "Este comentario es anónimo y no admite respuesta privada" }, 409)
    const { error } = await ctx.db.rpc("respond_to_feedback", { p_feedback_id: id, p_message: reply })
    if (error) {
      console.warn("[admin] no se pudo responder al comentario:", error.message)
      return json({ error: "No se pudo enviar la respuesta. Comprueba que la migración de respuestas esté aplicada." }, 503)
    }
    return json({ ok: true })
  }

  const { error } = await ctx.db.from("feedback").update({ status }).eq("id", id)
  if (error) return json({ error: "No se pudo actualizar" }, 500)
  return json({ ok: true })
}
