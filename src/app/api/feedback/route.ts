import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { notifyOwner } from "@/lib/server/notify"
import { cleanRoute, createRateLimiter } from "@/lib/error-report"
import { getClientIp, json, readJson } from "@/lib/server/auth-helpers"
import { hasDemoCookie } from "@/lib/demo/constants"
import { supabaseServer } from "@/lib/supabase-server"

// «Enviar comentario»: un fallo o una idea del usuario conectado. Se guarda
// en la tabla feedback (RLS: cada usuario solo puede crear filas suyas; solo
// Moha las lee) y, si hay proveedor de email configurado, le llega un aviso.
const allowUser = createRateLimiter(5, 10 * 60_000)
const allowDemoIp = createRateLimiter(3, 10 * 60_000)
const FEEDBACK_MAX = 2000
const TOO_MANY = "Has enviado varios comentarios seguidos. Prueba dentro de un rato."

export async function POST(request: Request) {
  const ctx = await getDataContext().catch(() => null)
  const demo = !ctx && hasDemoCookie(request.headers.get("cookie"))
  if (!ctx && !demo) return unauthorizedResponse()
  const body = await readJson(request)
  const kind = body?.kind === "fallo" || body?.kind === "idea" ? body.kind : null
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!kind) return json({ error: "Elige si es un fallo o una idea" }, 400)
  if (message.length < 3) return json({ error: "Escribe un poco más para que podamos entenderlo" }, 400)
  if (message.length > FEEDBACK_MAX) return json({ error: `Máximo ${FEEDBACK_MAX} caracteres` }, 400)

  const page = typeof body?.page === "string" ? cleanRoute(body.page) : null
  const userAgent = request.headers.get("user-agent")?.slice(0, 300) ?? null

  // Visitante de la demo: sin cuenta, se guarda anónimo (función con límite global).
  if (!ctx) {
    if (!allowDemoIp(getClientIp(request))) return json({ error: TOO_MANY }, 429)
    const { error } = await supabaseServer.rpc("submit_demo_feedback", { p_kind: kind, p_message: message, p_page: page, p_user_agent: userAgent })
    if (error) {
      if (/demasiados/i.test(error.message)) return json({ error: TOO_MANY }, 429)
      console.warn("[feedback] demo: no se pudo guardar:", error.message)
      return json({ error: "No se pudo enviar ahora mismo. Inténtalo de nuevo en un momento." }, 503)
    }
    const emailed = await notifyOwner(`Garra · ${kind === "fallo" ? "Fallo" : "Idea"} desde la demo`, [kind === "fallo" ? "Nuevo FALLO (demo)" : "Nueva IDEA (demo)", "", message, "", `Página: ${page ?? "no indicada"}`, `Navegador: ${userAgent ?? "desconocido"}`].join("\n"))
    return json({ ok: true, emailed })
  }
  if (!allowUser(ctx.userId)) return json({ error: TOO_MANY }, 429)
  const { error } = await ctx.db.from("feedback").insert({
    user_id: ctx.userId,
    kind,
    message,
    page,
    email: ctx.email,
    user_agent: userAgent,
  })
  if (error) {
    if (/demasiados/i.test(error.message)) return json({ error: "Has enviado varios comentarios seguidos. Prueba dentro de un rato." }, 429)
    console.warn("[feedback] no se pudo guardar:", error.message)
    return json({ error: "No se pudo enviar ahora mismo. Inténtalo de nuevo en un momento." }, 503)
  }

  const emailed = await notifyOwner(
    `Garra · ${kind === "fallo" ? "Fallo" : "Idea"} de ${ctx.email ?? "un usuario"}`,
    [
      kind === "fallo" ? "Nuevo FALLO en Garra" : "Nueva IDEA para Garra",
      "",
      message,
      "",
      `Página: ${page ?? "no indicada"}`,
      `Usuario: ${ctx.email ?? ctx.userId}`,
      `Navegador: ${userAgent ?? "desconocido"}`,
    ].join("\n"),
  )
  return json({ ok: true, emailed })
}
