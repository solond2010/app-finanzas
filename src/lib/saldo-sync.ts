import type { Account, FinanceState, Transaction } from "./store"

/** Importe con signo: ingreso suma, cualquier otro tipo resta. */
export function signedAmount(t: Pick<Transaction, "tipo" | "monto">): number {
  return t.tipo === "ingreso" ? t.monto : -t.monto
}

export function isInitialTx(t: Pick<Transaction, "id" | "categoria">): boolean {
  return t.categoria === "Saldo inicial" && (t.id.startsWith("init_") || t.id.startsWith("adj_init_"))
}

/** Apertura sintética creada al cargar: solo vive en memoria, nunca se sincroniza ni se borra en el servidor. */
export function isLocalOnlyOpeningTx(t: Pick<Transaction, "id" | "localOnly">): boolean {
  return t.localOnly === true
}

export function accountLedgerSum(transactions: Transaction[], accountId: string): number {
  return transactions
    .filter((t) => t.cuenta_id === accountId && !isLocalOnlyOpeningTx(t))
    .reduce((sum, t) => sum + signedAmount(t), 0)
}

export function accountSaldoDivergesFromLedger(account: Account, transactions: Transaction[], epsilon = 0.005): boolean {
  return Math.abs(account.saldo - accountLedgerSum(transactions, account.id)) >= epsilon
}

/** init_ que, si se ignora, deja el ledger igual al saldo guardado. Solo se ocultan en memoria. */
export function phantomInitIds(accounts: Account[], transactions: Transaction[], epsilon = 0.005): string[] {
  const ids: string[] = []
  for (const account of accounts) {
    const initTx = transactions.find((t) => t.id === "init_" + account.id)
    if (!initTx) continue
    const sumWithout = transactions
      .filter((t) => t.cuenta_id === account.id && t.id !== initTx.id)
      .reduce((sum, t) => sum + signedAmount(t), 0)
    if (Math.abs(sumWithout - account.saldo) < epsilon) ids.push(initTx.id)
  }
  return ids
}

export function transactionsForSync(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => !isLocalOnlyOpeningTx(t))
}

export type PendingSaldoDelta = {
  id: string
  accountId: string
  delta: number
  ifInserted?: string[]
  ifDeleted?: string[]
  ifUpdated?: string[]
}

export function isPendingSaldoDelta(value: unknown): value is PendingSaldoDelta {
  if (!value || typeof value !== "object") return false
  const row = value as Partial<PendingSaldoDelta>
  return typeof row.id === "string" && typeof row.accountId === "string" && typeof row.delta === "number" && Number.isFinite(row.delta)
}

function txChanged(prev: Transaction, next: Transaction): boolean {
  return signedAmount(prev) !== signedAmount(next) || prev.cuenta_id !== next.cuenta_id
}

export function collectSaldoDeltas(
  prev: FinanceState,
  next: FinanceState,
  idFactory: () => string = () => "delta_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8),
): { newAccountIds: string[]; deltas: PendingSaldoDelta[] } {
  const prevAccounts = new Map(prev.accounts.map((account) => [account.id, account]))
  const prevTx = new Map(prev.transactions.map((t) => [t.id, t]))
  const nextTx = new Map(next.transactions.map((t) => [t.id, t]))
  const newAccountIds = next.accounts.filter((account) => !prevAccounts.has(account.id)).map((account) => account.id)
  const inserted = next.transactions.filter((t) => !prevTx.has(t.id) && !isLocalOnlyOpeningTx(t))
  const deleted = prev.transactions.filter((t) => !nextTx.has(t.id) && !isLocalOnlyOpeningTx(t))
  const updated = next.transactions.filter((t) => {
    const before = prevTx.get(t.id)
    return !!before && !isLocalOnlyOpeningTx(t) && !isLocalOnlyOpeningTx(before) && txChanged(before, t)
  })
  const deltas: PendingSaldoDelta[] = []
  for (const account of next.accounts) {
    if (newAccountIds.includes(account.id)) continue
    const before = prevAccounts.get(account.id)
    if (!before) continue
    const delta = Math.round((account.saldo - before.saldo) * 100) / 100
    if (delta === 0) continue
    const relatedInserted = inserted.filter((t) => t.cuenta_id === account.id).map((t) => t.id)
    const relatedDeleted = deleted.filter((t) => t.cuenta_id === account.id).map((t) => t.id)
    const relatedUpdated = updated
      .filter((t) => t.cuenta_id === account.id || prevTx.get(t.id)?.cuenta_id === account.id)
      .map((t) => t.id)
    deltas.push({
      id: idFactory(),
      accountId: account.id,
      delta,
      ifInserted: relatedInserted,
      ifDeleted: relatedDeleted,
      ifUpdated: relatedUpdated,
    })
  }
  return { newAccountIds, deltas }
}

export function shouldApplySaldoDelta(
  delta: Pick<PendingSaldoDelta, "ifInserted" | "ifDeleted" | "ifUpdated">,
  happened: { inserted: string[]; deleted: string[]; updated: string[] },
): boolean {
  const hit = (wanted: string[] | undefined, got: string[]) => !!wanted?.some((id) => got.includes(id))
  return hit(delta.ifInserted, happened.inserted) || hit(delta.ifDeleted, happened.deleted) || hit(delta.ifUpdated, happened.updated)
}

export function stripSaldoFromExistingAccounts(
  rows: Record<string, unknown>[],
  existingIds: Set<string>,
): Record<string, unknown>[] {
  return rows.map((row) => {
    if (typeof row.id === "string" && existingIds.has(row.id) && "saldo" in row) {
      const { saldo: _saldo, ...rest } = row
      return rest
    }
    return row
  })
}

/** Qué escribiría un sync tras cargar remoto y normalizar, sin acciones del usuario. */
export function cleanLoadSyncWrites(remote: FinanceState, local: FinanceState, pendingTransactionDeletes: string[] = []) {
  const hiddenPhantomInitIds = phantomInitIds(remote.accounts, remote.transactions)
  const uploaded = transactionsForSync(local.transactions)
  const remoteIds = new Set(remote.transactions.map((t) => t.id))
  const wouldUploadNewTransactions = uploaded.filter((t) => !remoteIds.has(t.id)).map((t) => t.id)
  const { deltas } = collectSaldoDeltas(remote, local)
  return {
    hiddenPhantomInitIds,
    wouldUploadNewTransactions,
    wouldDeleteTransactions: pendingTransactionDeletes,
    wouldSendSaldoDeltas: deltas,
    wouldWriteExistingAccountSaldo: false,
  }
}