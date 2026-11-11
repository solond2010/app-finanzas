import { createImplicitMailerClient } from "@/lib/server/implicit-auth"
import { countFailure, EMAIL_RE, guardAuthRequest, json, readJson } from "@/lib/server/auth-helpers"
import { CANONICAL_SITE_ORIGIN } from "@/lib/auth-redirect"

// Enlace para elegir una contraseña nueva. Siempre responde igual, exista o
// no el email, para no revelar quién tiene cuenta.
// La plantilla por defecto de Supabase usa {{ .ConfirmationURL }}. Pedimos el
// reset con flowType implicit y redirect a /auth/reset, para que el token
// viaje en el hash y no dependa del code verifier del navegador (Gmail, iPhone).
export async function POST(request: Request) {
  const blocked = guardAuthRequest(request)
  if (blocked) return blocked
  const body = await readJson(request)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!EMAIL_RE.test(email)) return json({ error: "Ese email no parece válido" }, 400)

  const supabase = createImplicitMailerClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${CANONICAL_SITE_ORIGIN}/auth/reset`,
  })
  if (error && /rate limit|too many/i.test(error.message)) {
    countFailure(request)
    return json({ error: "Demasiados intentos. Espera unos minutos." }, 429)
  }
  return json({ ok: true })
}
