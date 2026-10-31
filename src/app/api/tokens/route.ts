import { getDataContext, unauthorizedResponse } from "@/lib/server/request-context"
import { json, readJson } from "@/lib/server/auth-helpers"
import { generateApiToken, hashApiToken, tokenDisplayPrefix } from "@/lib/api-tokens"

// Claves personales para los Atajos de iPhone del usuario conectado.
// GET lista (sin la clave), POST crea (la clave se devuelve UNA sola vez),
// DELETE revoca. Siempre limitadas al propio usuario (filtro + RLS).
const MAX_ACTIVE_TOKENS = 10

export async function GET() {
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  const { data, error } = await ctx.db
    .from("api_tokens")
    .select("id, name, prefix, created_at, last_used_at")
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
  if (error) return json({ error: "Las claves aún no están disponibles (falta activar las cuentas)" }, 503)
  return json({ tokens: data ?? [] })
}

export async function POST(request: Request) {
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  const body = await readJson(request)
  const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim().slice(0, 60) : "Atajo de iPhone"

  const { count, error: countError } = await ctx.db
    .from("api_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .is("revoked_at", null)
  if (countError) return json({ error: "Las claves aún no están disponibles (falta activar las cuentas)" }, 503)
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) return json({ error: `Máximo ${MAX_ACTIVE_TOKENS} claves activas. Revoca alguna antes.` }, 400)

  const token = generateApiToken()
  const { data, error } = await ctx.db
    .from("api_tokens")
    .insert({ user_id: ctx.userId, name, prefix: tokenDisplayPrefix(token), token_hash: await hashApiToken(token) })
    .select("id, name, prefix, created_at, last_used_at")
    .single()
  if (error) return json({ error: "No se pudo crear la clave" }, 500)
  return json({ token, item: data })
}

export async function DELETE(request: Request) {
  const ctx = await getDataContext()
  if (!ctx) return unauthorizedResponse()
  const body = await readJson(request)
  const id = typeof body?.id === "string" ? body.id : ""
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Clave no válida" }, 400)
  const { error } = await ctx.db
    .from("api_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", ctx.userId)
    .eq("id", id)
  if (error) return json({ error: "No se pudo revocar la clave" }, 500)
  return json({ ok: true })
}
