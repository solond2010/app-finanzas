import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"
import { isSupabaseAuthEnabled } from "@/lib/auth-mode"

// Recibe los tokens del hash (#access_token) y abre sesión con cookies en
// este navegador. El hash nunca llega al servidor: lo lee el cliente.
export async function POST(request: Request) {
  if (!isSupabaseAuthEnabled()) return json({ error: "Las cuentas de usuario aún no están activadas" }, 404)
  const body = await readJson(request)
  const access_token = typeof body?.access_token === "string" ? body.access_token : ""
  const refresh_token = typeof body?.refresh_token === "string" ? body.refresh_token : ""
  if (!access_token || !refresh_token) return json({ error: "Faltan los datos de la sesión" }, 400)

  const supabase = await createSupabaseRouteClient()
  const { error } = await supabase.auth.setSession({ access_token, refresh_token })
  if (error) return json({ error: "Este enlace ya se usó o ha caducado. Pide otro." }, 400)
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json({ error: "Este enlace ya se usó o ha caducado. Pide otro." }, 401)
  return json({ ok: true })
}
