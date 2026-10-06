import type { FinanceState } from "./store"
import type { Contribution, Position } from "./investments"

export type IntegrityFinding = { code: string; label: string; count: number; details?: string[] }

/** Read-only audit: report inconsistencies without rewriting or deleting records. */
export function auditFinanceState(state: FinanceState, positions: Position[] = [], contributions: Contribution[] = []): IntegrityFinding[] {
  const findings: IntegrityFinding[] = []
  const duplicateCount = <T,>(rows: T[], id: (row: T) => string) => {
    const seen = new Set<string>()
    let duplicates = 0
    for (const row of rows) {
      const value = id(row)
      if (seen.has(value)) duplicates++
      seen.add(value)
    }
    return duplicates
  }
  const add = (code: string, label: string, count: number, details?: string[]) => {
    if (count > 0) findings.push({ code, label, count, ...(details?.length ? { details: details.slice(0, 5) } : {}) })
  }

  add("duplicate-accounts", "Cuentas con identificadores repetidos", duplicateCount(state.accounts, (row) => row.id))
  add("duplicate-transactions", "Movimientos con identificadores repetidos", duplicateCount(state.transactions, (row) => row.id))
  add("duplicate-funds", "Metas con identificadores repetidos", duplicateCount(state.sinkingFunds, (row) => row.id))
  add("duplicate-categories", "Categorías con identificadores repetidos", duplicateCount(state.categories, (row) => row.id))
  add("duplicate-budgets", "Presupuestos con identificadores repetidos", duplicateCount(state.budgets, (row) => row.id))

  const accountIds = new Set(state.accounts.map((row) => row.id))
  const categoryIds = new Set(state.categories.map((row) => row.id))
  add("orphan-transactions", "Movimientos sin cuenta asociada", state.transactions.filter((row) => !accountIds.has(row.cuenta_id)).length)
  add("orphan-funds", "Metas sin cuenta asociada", state.sinkingFunds.filter((row) => !accountIds.has(row.cuenta_id)).length)
  add("orphan-budgets", "Presupuestos sin categoría asociada", state.budgets.filter((row) => !categoryIds.has(row.category_id)).length)
  add("invalid-amounts", "Movimientos con importe no válido", state.transactions.filter((row) =>
    !Number.isFinite(row.monto) || (row.monto <= 0 && !(row.id.startsWith("adj_") && row.monto < 0))
  ).length)
  add("invalid-types", "Movimientos con tipo desconocido", state.transactions.filter((row) => row.tipo !== "ingreso" && row.tipo !== "gasto").length)
  add("invalid-balances", "Cuentas con saldo no numérico", state.accounts.filter((row) => !Number.isFinite(row.saldo)).length)
  add("invalid-dates", "Movimientos con fecha no válida", state.transactions.filter((row) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) return true
    const date = new Date(`${row.fecha}T00:00:00Z`)
    return !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.fecha
  }).length)

  const ledgerByAccount = new Map<string, number>()
  for (const transaction of state.transactions) {
    if (!Number.isFinite(transaction.monto)) continue
    const signed = transaction.tipo === "ingreso" ? transaction.monto : -transaction.monto
    ledgerByAccount.set(transaction.cuenta_id, (ledgerByAccount.get(transaction.cuenta_id) ?? 0) + signed)
  }
  const mismatchedAccounts = state.accounts.filter((account) => Number.isFinite(account.saldo) && Math.abs(account.saldo - (ledgerByAccount.get(account.id) ?? 0)) > 0.02)
  add("balance-mismatch", "Cuentas cuyo saldo no cuadra con su historial", mismatchedAccounts.length, mismatchedAccounts.map((account) => {
    const ledger = ledgerByAccount.get(account.id) ?? 0
    const money = (value: number) => `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${account.currency ?? "€"}`
    return `${account.nombre}: saldo ${money(account.saldo)} · historial ${money(ledger)}`
  }))
  const normalizedNames = state.categories.map((row) => row.name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES"))
  add("duplicate-category-names", "Categorías con nombres duplicados", normalizedNames.length - new Set(normalizedNames).size)

  const positionIds = new Set(positions.map((position) => position.id))
  const investmentAccountIds = new Set(state.accounts.map((account) => account.id))
  const unlinkedPositions = positions.filter((position) => !position.accountId || !investmentAccountIds.has(position.accountId))
  add("orphan-positions", "Posiciones de inversión sin cuenta asociada", unlinkedPositions.length,
    unlinkedPositions.map((position) => position.name || position.symbol))
  add("duplicate-positions", "Posiciones de inversión con identificadores repetidos", duplicateCount(positions, (position) => position.id))
  const invalidPositions = positions.filter((position) => !Number.isFinite(position.units) || position.units <= 0 || !Number.isFinite(position.buyPrice) || position.buyPrice < 0)
  add("invalid-positions", "Posiciones con unidades o precio no válido", invalidPositions.length,
    invalidPositions.map((position) => position.name || position.symbol))
  const orphanContributions = contributions.filter((contribution) => !positionIds.has(contribution.positionId))
  add("orphan-contributions", "Aportes vinculados a posiciones inexistentes", orphanContributions.length,
    orphanContributions.map((contribution) => contribution.date))
  const invalidContributions = contributions.filter((contribution) => !Number.isFinite(contribution.amount) || contribution.amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(contribution.date))
  add("invalid-contributions", "Aportes de inversión con importe o fecha no válido", invalidContributions.length)
  return findings
}
