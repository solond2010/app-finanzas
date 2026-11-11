import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { countFailure, EMAIL_RE, guardAuthRequest, json, readJson, siteOrigin } from "@/lib/server/auth-helpers"

// Enlace para elegir una contraseña nueva. Siempre responde igual, exista o
// no el email, para no revelar quién tiene cuenta. La plantilla de Supabase
// debe apuntar a /auth/confirm?token_hash=…&type=recovery (no al ?code de PKCE),
// para que funcione al abrirlo desde Gmail u otro navegador.
export async function POST(request: Request) {
  const blocked = guardAuthRequest(request)
  if (blocked) return blocked
  const body = await readJson(request)
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!EMAIL_RE.test(email)) return json({ error: "Ese email no parece válido" }, 400)

  const supabase = await createSupabaseRouteClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteOrigin(request)}/auth/callback?type=recovery&next=/auth/reset`,
  })
  if (error && /rate limit|too many/i.test(error.message)) {
    countFailure(request)
    return json({ error: "Demasiados intentos. Espera unos minutos." }, 429)
  }
  return json({ ok: true })
}
