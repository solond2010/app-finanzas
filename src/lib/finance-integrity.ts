import type { FinanceState } from "./store"

export type IntegrityFinding = { code: string; label: string; count: number }

/** Read-only audit: report inconsistencies without rewriting or deleting records. */
export function auditFinanceState(state: FinanceState): IntegrityFinding[] {
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
  const add = (code: string, label: string, count: number) => { if (count > 0) findings.push({ code, label, count }) }

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
  add("balance-mismatch", "Cuentas cuyo saldo no cuadra con su historial", state.accounts.filter((account) => Number.isFinite(account.saldo) && Math.abs(account.saldo - (ledgerByAccount.get(account.id) ?? 0)) > 0.02).length)
  const normalizedNames = state.categories.map((row) => row.name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES"))
  add("duplicate-category-names", "Categorías con nombres duplicados", normalizedNames.length - new Set(normalizedNames).size)
  return findings
}
