import "server-only"
import { NextResponse } from "next/server"
import { supabaseServer } from "@/lib/supabase-server"
import { timingSafeEqualString } from "@/lib/auth"
import { LEGACY_USER_ID } from "@/lib/auth-mode"
import { hashApiToken, looksLikeApiToken } from "@/lib/api-tokens"

// ¿De quién es esta llamada de un Atajo de iPhone (o del script de copias)?
//  1) Clave personal (fz_…) creada en Configuración → se busca su hash en
//     api_tokens y se devuelve su dueño. Revocada = no vale.
//  2) SHORTCUTS_SECRET antiguo (transición) → dueño histórico, o el usuario
//     de SHORTCUTS_SECRET_USER_ID si se definió.
// La clave viaja en la cabecera x-shortcuts-secret (la misma de siempre, para
// no tocar los Atajos) o como "Authorization: Bearer …".

export function readShortcutCredential(request: Request): string | null {
  const header = request.headers.get("x-shortcuts-secret")
  if (header) return header.trim()
  const auth = request.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim()
  return null
}

export async function resolveShortcutUser(request: Request): Promise<{ userId: string } | NextResponse> {
  const provided = readShortcutCredential(request)
  const denied = NextResponse.json({ error: "No autorizado" }, { status: 401, headers: { "Cache-Control": "no-store" } })
  if (!provided) return denied

  const legacySecret = process.env.SHORTCUTS_SECRET
  if (legacySecret && timingSafeEqualString(provided, legacySecret)) {
    return { userId: process.env.SHORTCUTS_SECRET_USER_ID || LEGACY_USER_ID }
  }

  if (!looksLikeApiToken(provided)) return denied
  const tokenHash = await hashApiToken(provided)
  const { data, error } = await supabaseServer
    .from("api_tokens")
    .select("id, user_id")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle()
  if (error || !data) return denied
  const row = data as { id: string; user_id: string }
  // Fecha de último uso: informativa, no bloquea la respuesta si falla.
  void supabaseServer.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then(() => {}, () => {})
  return { userId: row.user_id }
}
