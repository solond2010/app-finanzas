import { isSupabaseAuthEnabled } from "@/lib/auth-mode"
import { createSupabaseRouteClient } from "@/lib/server/request-context"
import { friendlyAuthError, json, readJson } from "@/lib/server/auth-helpers"

// Poner o cambiar la contraseña del usuario conectado (p. ej. tras entrar
// con el enlace por email).
export async function POST(request: Request) {
  if (!isSupabaseAuthEnabled()) return json({ error: "Las cuentas de usuario aún no están activadas" }, 404)
  const body = await readJson(request)
  const password = typeof body?.password === "string" ? body.password : ""
  if (password.length < 8 || password.length > 128) return json({ error: "La contraseña debe tener entre 8 y 128 caracteres" }, 400)
  const supabase = await createSupabaseRouteClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) return json({ error: "No has iniciado sesión" }, 401)
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return json({ error: friendlyAuthError(error.message) }, 400)
  return json({ ok: true })
}
