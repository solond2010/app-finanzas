import "server-only"

import { supabaseServer } from "@/lib/supabase-server"
import { generateMcpToken, hashMcpToken, isMcpTokenFormat } from "@/lib/mcp/token"
import type { McpTokenItem } from "@/lib/mcp/public"

export type McpAuthUser = {
  userId: string
  tokenId: string
}

export type { McpTokenItem }

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

export async function listActiveMcpTokens(userId: string): Promise<McpTokenItem[]> {
  const { data, error } = await supabaseServer
    .from("mcp_tokens")
    .select("id, name, created_at, last_used_at")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as McpTokenItem[]
}

export async function countActiveMcpTokens(userId: string): Promise<number> {
  const { count, error } = await supabaseServer
    .from("mcp_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("revoked_at", null)
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function issueMcpToken(userId: string, name = "MCP"): Promise<{ token: string; item: McpTokenItem }> {
  const token = generateMcpToken()
  const { data, error } = await supabaseServer
    .from("mcp_tokens")
    .insert({ user_id: userId, token_hash: hashMcpToken(token), name })
    .select("id, name, created_at, last_used_at")
    .single()
  if (error || !data) throw new Error(error?.message ?? "No se pudo crear el token MCP")
  return { token, item: data as McpTokenItem }
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
