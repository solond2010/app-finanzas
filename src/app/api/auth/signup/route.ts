import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { countFailure, EMAIL_RE, friendlyAuthError, guardAuthRequest, json, readJson, siteOrigin } from "@/lib/server/auth-helpers"

export async function POST(request: Request) {
  const blocked = guardAuthRequest(request)
  if (blocked) return blocked
  if (process.env.SIGNUPS_DISABLED === "true") return json({ error: "El registro está cerrado por ahora" }, 403)
  const body = await readJson(request)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""
  if (!EMAIL_RE.test(email)) return json({ error: "Ese email no parece válido" }, 400)
  if (password.length < 8 || password.length > 128) return json({ error: "La contraseña debe tener entre 8 y 128 caracteres" }, 400)

  const supabase = await createSupabaseRouteClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteOrigin(request)}/auth/callback` },
  })
  if (error) {
    countFailure(request)
    return json({ error: friendlyAuthError(error.message) }, 400)
  }
  // Con "Confirmar email" activado en Supabase no hay sesión hasta pulsar el
  // enlace del correo; sin él, el usuario ya entra directamente.
  return json({ ok: true, needsConfirmation: !data.session })
}
