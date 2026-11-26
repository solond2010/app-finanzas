import { applySaldoDelta } from "@/lib/server/saldo-delta"

export type LedgerTx = {
  id: string
  cuenta_id: string
  monto: number
  tipo: string
}

export type AccountSaldoDelta = {
  accountId: string
  delta: number
}

/** Importe con signo: ingreso suma, cualquier otro tipo resta. */
export function signedMonto(tipo: string, monto: number): number {
  const value = Number(monto)
  if (!Number.isFinite(value)) return 0
  return tipo === "ingreso" ? value : -value
}

function addDelta(net: Map<string, number>, accountId: string, delta: number) {
  if (!accountId) return
  const next = Math.round(((net.get(accountId) ?? 0) + delta) * 100) / 100
  if (next === 0) net.delete(accountId)
  else net.set(accountId, next)
}

/**
 * Calcula el cambio de saldo a partir de lo que de verdad se escribe o borra
 * en movimientos, no a partir de un saldo absoluto ni de un delta que mande
 * el cliente. Un reintento que reenvía un movimiento ya guardado con los
 * mismos datos no vuelve a mover el saldo.
 */
export function netSaldoDeltasFromWrites(args: {
  incoming: LedgerTx[]
  existing: LedgerTx[]
  deletedIds?: string[]
}): AccountSaldoDelta[] {
  const current = new Map(args.existing.map((row) => [row.id, row]))
  const incomingIds = new Set(args.incoming.map((row) => row.id))
  const net = new Map<string, number>()

  for (const row of args.incoming) {
    const next = signedMonto(row.tipo, row.monto)
    const before = current.get(row.id)
    if (!before) {
      addDelta(net, row.cuenta_id, next)
      continue
    }
    const prev = signedMonto(before.tipo, before.monto)
    if (before.cuenta_id === row.cuenta_id) {
      addDelta(net, row.cuenta_id, next - prev)
    } else {
      addDelta(net, before.cuenta_id, -prev)
      addDelta(net, row.cuenta_id, next)
    }
  }

  for (const id of args.deletedIds ?? []) {
    if (incomingIds.has(id)) continue
    const before = current.get(id)
    if (!before) continue
    addDelta(net, before.cuenta_id, -signedMonto(before.tipo, before.monto))
  }

  return [...net.entries()].map(([accountId, delta]) => ({ accountId, delta }))
}

/** Deja el saldo de las cuentas nuevas en 0: el movimiento de apertura lo sube. Nunca reescribe el saldo de una cuenta que ya existe. */
export function accountsForSaldoSafeUpsert(
  rows: Record<string, unknown>[],
  existingIds: Set<string>,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const id = typeof row.id === "string" ? row.id : ""
    if (id && existingIds.has(id)) {
      const { saldo: _saldo, ...rest } = row
      return rest
    }
    return { ...row, saldo: 0 }
  })
}

export async function applyComputedSaldoDeltas(
  db: { from: Parameters<typeof applySaldoDelta>[0]["from"] },
  userId: string,
  deltas: AccountSaldoDelta[],
): Promise<void> {
  for (const delta of deltas) {
    await applySaldoDelta(db, userId, delta.accountId, delta.delta)
  }
}

export function toLedgerTx(row: { id: string; cuenta_id?: unknown; monto?: unknown; tipo?: unknown }): LedgerTx | null {
  if (typeof row.cuenta_id !== "string" || !row.cuenta_id) return null
  const monto = Number(row.monto)
  if (!Number.isFinite(monto)) return null
  const tipo = typeof row.tipo === "string" ? row.tipo : ""
  if (tipo !== "ingreso" && tipo !== "gasto") return null
  return { id: row.id, cuenta_id: row.cuenta_id, monto, tipo }
}
