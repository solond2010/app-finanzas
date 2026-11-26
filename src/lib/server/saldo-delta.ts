import type { SupabaseClient } from "@supabase/supabase-js"
import { shouldApplySaldoDelta, type PendingSaldoDelta } from "@/lib/saldo-sync"

type ScopedDb = { from: SupabaseClient["from"] }

export async function applySaldoDelta(
  db: ScopedDb,
  userId: string,
  accountId: string,
  delta: number,
): Promise<void> {
  const rounded = Math.round(delta * 100) / 100
  if (rounded === 0) return
  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await db
      .from("accounts")
      .select("saldo")
      .eq("user_id", userId)
      .eq("id", accountId)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error("La cuenta no existe")
    const current = data.saldo
    const next = Math.round((Number(current) + rounded) * 100) / 100
    const { data: updated, error: updateError } = await db
      .from("accounts")
      .update({ saldo: next })
      .eq("user_id", userId)
      .eq("id", accountId)
      .eq("saldo", current)
      .select("id")
    if (updateError) throw updateError
    if (updated && updated.length > 0) return
  }
  throw new Error("No se pudo actualizar el saldo de forma consistente")
}

export async function applyConditionalSaldoDeltas(
  db: ScopedDb,
  userId: string,
  deltas: PendingSaldoDelta[],
  happened: { inserted: string[]; deleted: string[]; updated: string[] },
): Promise<void> {
  for (const delta of deltas) {
    if (!shouldApplySaldoDelta(delta, happened)) continue
    await applySaldoDelta(db, userId, delta.accountId, delta.delta)
  }
}

export type ExistingTransaction = {
  id: string
  cuenta_id: string
  monto: number | string
  tipo: string
}

export function classifyTransactionWrites(
  incoming: { id: string; cuenta_id?: unknown; monto?: unknown; tipo?: unknown }[],
  existing: ExistingTransaction[],
): { inserted: string[]; updated: string[] } {
  const current = new Map(existing.map((row) => [row.id, row]))
  const inserted: string[] = []
  const updated: string[] = []
  for (const row of incoming) {
    const before = current.get(row.id)
    if (!before) {
      inserted.push(row.id)
      continue
    }
    const prevSigned = before.tipo === "ingreso" ? Number(before.monto) : -Number(before.monto)
    const nextTipo = typeof row.tipo === "string" ? row.tipo : before.tipo
    const nextMonto = row.monto == null ? Number(before.monto) : Number(row.monto)
    const nextSigned = nextTipo === "ingreso" ? nextMonto : -nextMonto
    const nextAccount = typeof row.cuenta_id === "string" ? row.cuenta_id : before.cuenta_id
    if (prevSigned !== nextSigned || nextAccount !== before.cuenta_id) updated.push(row.id)
  }
  return { inserted, updated }
}
