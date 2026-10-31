import { clearLoginAttempts } from "@/lib/auth"
import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { countFailure, friendlyAuthError, getClientIp, guardAuthRequest, json, readJson } from "@/lib/server/auth-helpers"

export async function POST(request: Request) {
  const blocked = guardAuthRequest(request)
  if (blocked) return blocked
  const body = await readJson(request)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (!email || !password) return json({ error: "Escribe tu email y tu contraseña" }, 400)

  const supabase = await createSupabaseRouteClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    countFailure(request)
    return json({ error: friendlyAuthError(error.message) }, 401)
  }
  clearLoginAttempts(getClientIp(request))
  return json({ ok: true })
}
