import type { Account, Transaction, MonthlySummary, NetWorthSnapshot } from "./store"
import { convertToEur } from "./currency"

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

function parseMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number)
  return new Date(year, month - 1, 1)
}

function getMonthWindow(endMonthKey: string | undefined, count = 6) {
  const end = endMonthKey ? parseMonthKey(endMonthKey) : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  return Array.from({ length: count }, (_, index) => getMonthKey(new Date(end.getFullYear(), end.getMonth() - (count - 1 - index), 1)))
}

function isInMonth(dateString: string, monthKey: string) {
  const d = new Date(dateString)
  const monthDate = parseMonthKey(monthKey)
  return d.getFullYear() === monthDate.getFullYear() && d.getMonth() === monthDate.getMonth()
}

function isAfterMonth(dateString: string, monthKey: string) {
  const d = new Date(dateString)
  const nextMonth = new Date(parseMonthKey(monthKey).getFullYear(), parseMonthKey(monthKey).getMonth() + 1, 1)
  return d >= nextMonth
}

function transactionDelta(t: Transaction) {
  return t.tipo === "ingreso" ? t.monto : -t.monto
}

// Un traspaso entre cuentas propias se registra como gasto en la cuenta origen
// e ingreso en la destino (para que cuadren los saldos), pero NO es un ingreso
// ni un gasto real, así que se excluye de los totales de reporte. En patrimonio
// ya netea a cero (–50 origen + 50 destino).
export function isTransfer(t: Transaction) {
  return t.tags?.includes("traspaso") ?? false
}

export function filterTransactionsByMonth(transactions: Transaction[], monthKey?: string) {
  if (!monthKey) return transactions
  return transactions.filter((t) => isInMonth(t.fecha, monthKey))
}

export function getLastQuarterTransactions(transactions: Transaction[]) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  return transactions.filter((t) => new Date(t.fecha) >= threeMonthsAgo)
}

export function calculateAverageMonthlyNeeds(transactions: Transaction[]): number {
  const lastQuarter = getLastQuarterTransactions(transactions)
  const needsExpenses = lastQuarter.filter((t) => t.tipo === "gasto" && t.es_necesidad)
  const totalNeeds = needsExpenses.reduce((sum, t) => sum + t.monto, 0)
  return Math.round(totalNeeds / 3)
}

export function calculateEmergencyFund(transactions: Transaction[], accounts: Account[], months: number): { needed: number; saved: number } {
  const monthlyAvg = calculateAverageMonthlyNeeds(transactions)
  const needed = monthlyAvg * months
  const emergencyAccount = accounts.find((a) => a.tipo === "emergencia")
  const saved = emergencyAccount?.saldo ?? 0
  return { needed, saved }
}

export function getCurrentMonthTotals(transactions: Transaction[]) {
  const { ingresos, gastos } = getMonthTotals(transactions, 0)
  return { ingresos, gastos, neto: ingresos - gastos }
}

export function getMonthTotalsByString(transactions: Transaction[], month: string) {
  const monthTxns = filterTransactionsByMonth(transactions, month)
  const ingresos = monthTxns.filter((t) => t.tipo === "ingreso" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)
  const gastos = monthTxns.filter((t) => t.tipo === "gasto" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)
  return { ingresos, gastos, neto: ingresos - gastos }
}

// neto/ingresos no tiene techo por abajo (gastos puede disparar la ratio), así
// que se acota en -100% para evitar cifras absurdas cuando los ingresos del mes son bajos.
export function getSavingsRate(ingresos: number, neto: number): number {
  if (ingresos <= 0) return 0
  return Math.max(-100, Math.round((neto / ingresos) * 100))
}

export function getMonthTotals(transactions: Transaction[], monthsAgo: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const month = d.getMonth()
  const year = d.getFullYear()

  const monthTxns = transactions.filter((t) => {
    const td = new Date(t.fecha)
    return td.getMonth() === month && td.getFullYear() === year
  })

  const ingresos = monthTxns.filter((t) => t.tipo === "ingreso" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)
  const gastos = monthTxns.filter((t) => t.tipo === "gasto" && !isTransfer(t)).reduce((s, t) => s + t.monto, 0)

  return { ingresos, gastos, neto: ingresos - gastos, label: formatMonth(d) }
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
}

export function getCurrentMonthNeedsVsWants(transactions: Transaction[]) {
  return getNeedsVsWantsForMonth(transactions)
}

export function getNeedsVsWantsForMonth(transactions: Transaction[], monthKey?: string) {
  const monthTransactions = filterTransactionsByMonth(transactions, monthKey).filter((t) => t.tipo === "gasto" && !isTransfer(t))
  const necesidades = monthTransactions.filter((t) => t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  const deseos = monthTransactions.filter((t) => !t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  return { necesidades, deseos }
}

export function getNetWorth(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + convertToEur(a.saldo, a.currency), 0)
}

export function getAccountsAtMonth(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  if (!monthKey) return accounts
  return accounts.map((account) => {
    const futureTransactions = transactions.filter((t) => t.cuenta_id === account.id && isAfterMonth(t.fecha, monthKey))
    const balanceDelta = futureTransactions.reduce((sum, t) => sum + transactionDelta(t), 0)
    return { ...account, saldo: account.saldo - balanceDelta }
  })
}

export function getNetWorthAtMonth(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  return getNetWorth(getAccountsAtMonth(accounts, transactions, monthKey))
}

export function getCategoryBreakdown(transactions: Transaction[], monthKey?: string) {
  const gastos = filterTransactionsByMonth(transactions, monthKey).filter((t) => t.tipo === "gasto" && !isTransfer(t))

  const breakdown: Record<string, number> = {}
  for (const t of gastos) {
    breakdown[t.categoria] = (breakdown[t.categoria] || 0) + t.monto
  }

  return Object.entries(breakdown)
    .map(([categoria, monto]) => ({ categoria, monto }))
    .sort((a, b) => b.monto - a.monto)
}

export function calculateMonthlySaving(amountTarget: number, current: number, deadline: string): number {
  const now = new Date()
  const end = new Date(deadline)
  const monthsLeft = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth())
  if (monthsLeft <= 0) return 0
  return Math.round((amountTarget - current) / monthsLeft)
}

export function buildMonthlySummaries(transactions: Transaction[]): MonthlySummary[] {
  return buildMonthlySummariesUpTo(transactions)
}

export function buildMonthlySummariesUpTo(transactions: Transaction[], endMonthKey?: string): MonthlySummary[] {
  return getMonthWindow(endMonthKey).map((month) => {
    const { ingresos, gastos } = getMonthTotalsByString(transactions, month)
    return { mes: formatMonth(parseMonthKey(month)), ingresos, gastos }
  })
}

export function buildMonthlyCashFlow(transactions: Transaction[], endMonthKey?: string): { mes: string; ingresos: number; gastos: number; neto: number }[] {
  return getMonthWindow(endMonthKey).map((month) => {
    const { ingresos, gastos, neto } = getMonthTotalsByString(transactions, month)
    return { mes: formatMonth(parseMonthKey(month)), ingresos, gastos, neto }
  })
}

export function buildNetWorthHistory(transactions: Transaction[], accounts: Account[], endMonthKey?: string): NetWorthSnapshot[] {
  return getMonthWindow(endMonthKey).map((month) => ({
    mes: formatMonth(parseMonthKey(month)),
    patrimonio: getNetWorthAtMonth(accounts, transactions, month),
  }))
}

export function getGastosBudgetProgress(accounts: Account[], transactions: Transaction[], monthKey?: string) {
  const gastosAccount = accounts.find((a) => a.tipo === "gastos")
  if (!gastosAccount || !gastosAccount.limite_mensual) return null

  const gastado = filterTransactionsByMonth(transactions, monthKey)
    .filter((t) => t.tipo === "gasto" && t.cuenta_id === gastosAccount.id)
    .reduce((s, t) => s + t.monto, 0)

  return {
    gastado,
    limite: gastosAccount.limite_mensual,
    restante: gastosAccount.limite_mensual - gastado,
    progreso: Math.min(Math.round((gastado / gastosAccount.limite_mensual) * 100), 100),
  }
}
