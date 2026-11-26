import "server-only"

import { canUseConnectors, jsonArrayContains } from "@/lib/billing/connectors-access"
import { getUserPlanRow, paymentsEnabled } from "@/lib/server/billing"
import { supabaseServer } from "@/lib/supabase-server"

// Lectura pura: no inserta, no actualiza, no revoca ni marca filas.

type CreatedRow = { created_at: string | null }

async function createdAtFrom(table: "mcp_tokens" | "api_tokens" | "oauth_grants", userId: string): Promise<string[]> {
  const { data, error } = await supabaseServer.from(table).select("created_at").eq("user_id", userId)
  if (error) throw new Error(error.message)
  return ((data ?? []) as CreatedRow[]).map((row) => row.created_at).filter((value): value is string => Boolean(value))
}

async function createdAtFromTaggedTransactions(userId: string, tag: "atajo" | "mcp"): Promise<string[]> {
  const { data, error } = await supabaseServer
    .from("transactions")
    .select("created_at")
    .eq("user_id", userId)
    .filter("tags", "cs", jsonArrayContains(tag))
    .limit(20)
  if (error) throw new Error(error.message)
  return ((data ?? []) as CreatedRow[]).map((row) => row.created_at).filter((value): value is string => Boolean(value))
}

/** Fechas de conexión o uso ya existentes: tokens MCP, claves del Atajo, grants OAuth y movimientos etiquetados. */
export async function loadConnectorEvidenceCreatedAt(userId: string): Promise<string[]> {
  const settled = await Promise.allSettled([
    createdAtFrom("mcp_tokens", userId),
    createdAtFrom("api_tokens", userId),
    createdAtFrom("oauth_grants", userId),
    createdAtFromTaggedTransactions(userId, "atajo"),
    createdAtFromTaggedTransactions(userId, "mcp"),
  ])
  const dates: string[] = []
  for (const result of settled) {
    if (result.status === "fulfilled") dates.push(...result.value)
    else console.warn("[connectors] evidencia:", result.reason instanceof Error ? result.reason.message : result.reason)
  }
  return dates
}

export async function userCanUseConnectors(userId: string): Promise<boolean> {
  if (!paymentsEnabled()) return true
  const row = await getUserPlanRow(userId)
  const plan = row?.plan ?? "free"
  const source = row?.source ?? null
  const subscriptionStatus = row?.subscription_status ?? null
  if (canUseConnectors({ paymentsEnabled: true, plan, source, subscriptionStatus, evidenceCreatedAt: [] })) {
    return true
  }
  const evidenceCreatedAt = await loadConnectorEvidenceCreatedAt(userId)
  return canUseConnectors({ paymentsEnabled: true, plan, source, subscriptionStatus, evidenceCreatedAt })
}
