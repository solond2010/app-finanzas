import type { Account, Transaction, MonthlySummary, NetWorthSnapshot } from "./store"

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

export function getMonthTotals(transactions: Transaction[], monthsAgo: number) {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1)
  const month = d.getMonth()
  const year = d.getFullYear()

  const monthTxns = transactions.filter((t) => {
    const td = new Date(t.fecha)
    return td.getMonth() === month && td.getFullYear() === year
  })

  const ingresos = monthTxns.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0)
  const gastos = monthTxns.filter((t) => t.tipo === "gasto").reduce((s, t) => s + t.monto, 0)

  return { ingresos, gastos, neto: ingresos - gastos, label: formatMonth(d) }
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
}

export function getCurrentMonthNeedsVsWants(transactions: Transaction[]) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthTransactions = transactions.filter((t) => {
    const d = new Date(t.fecha)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.tipo === "gasto"
  })

  const necesidades = monthTransactions.filter((t) => t.es_necesidad).reduce((s, t) => s + t.monto, 0)
  const deseos = monthTransactions.filter((t) => !t.es_necesidad).reduce((s, t) => s + t.monto, 0)

  return { necesidades, deseos }
}

export function getNetWorth(accounts: Account[]): number {
  return accounts.reduce((sum, a) => sum + a.saldo, 0)
}

export function getCategoryBreakdown(transactions: Transaction[]) {
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const gastos = transactions.filter((t) => {
    const d = new Date(t.fecha)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.tipo === "gasto"
  })

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
  const months: MonthlySummary[] = []
  for (let i = 5; i >= 0; i--) {
    const { label, ingresos, gastos } = getMonthTotals(transactions, i)
    months.push({ mes: label, ingresos, gastos })
  }
  return months
}

export function buildMonthlyCashFlow(transactions: Transaction[]): { mes: string; ingresos: number; gastos: number; neto: number }[] {
  const result: { mes: string; ingresos: number; gastos: number; neto: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const { label, ingresos, gastos, neto } = getMonthTotals(transactions, i)
    result.push({ mes: label, ingresos, gastos, neto })
  }
  return result
}

export function buildNetWorthHistory(transactions: Transaction[], accounts: Account[]): NetWorthSnapshot[] {
  const currentNetWorth = getNetWorth(accounts)
  const months: NetWorthSnapshot[] = []

  let cumulative = currentNetWorth
  for (let i = 0; i < 6; i++) {
    const { neto, label } = getMonthTotals(transactions, i)
    months.unshift({ mes: label, patrimonio: cumulative })
    cumulative -= neto
  }

  return months
}

export function getGastosBudgetProgress(accounts: Account[], transactions: Transaction[]) {
  const gastosAccount = accounts.find((a) => a.tipo === "gastos")
  if (!gastosAccount || !gastosAccount.limite_mensual) return null

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const gastado = transactions
    .filter((t) => {
      const d = new Date(t.fecha)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear && t.tipo === "gasto" && t.cuenta_id === gastosAccount.id
    })
    .reduce((s, t) => s + t.monto, 0)

  return {
    gastado,
    limite: gastosAccount.limite_mensual,
    restante: gastosAccount.limite_mensual - gastado,
    progreso: Math.min(Math.round((gastado / gastosAccount.limite_mensual) * 100), 100),
  }
}
