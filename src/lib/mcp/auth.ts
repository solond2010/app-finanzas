import "server-only"

import { supabaseServer } from "@/lib/supabase-server"
import { generateMcpToken, hashMcpToken, isMcpTokenFormat } from "@/lib/mcp/token"

export type McpAuthUser = {
  userId: string
  tokenId: string
}

type TokenRow = {
  id: string
  user_id: string
  revoked_at: string | null
}

export async function resolveMcpUser(token: string): Promise<McpAuthUser | null> {
  if (!isMcpTokenFormat(token)) return null
  const tokenHash = hashMcpToken(token)
  const { data, error } = await supabaseServer
    .from("mcp_tokens")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle()
  if (error || !data) return null
  const row = data as TokenRow
  if (row.revoked_at) return null
  void supabaseServer
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => undefined, () => undefined)
  return { userId: row.user_id, tokenId: row.id }
}

export async function issueMcpToken(userId: string, name = "MCP"): Promise<{ token: string; id: string }> {
  const token = generateMcpToken()
  const { data, error } = await supabaseServer
    .from("mcp_tokens")
    .insert({ user_id: userId, token_hash: hashMcpToken(token), name })
    .select("id")
    .single()
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el token MCP")
  return { token, id: (data as { id: string }).id }
}

export async function revokeMcpToken(userId: string, tokenId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("mcp_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}
