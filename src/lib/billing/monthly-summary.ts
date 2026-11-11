// Resumen del último mes cerrado (o del mes en curso si aún no hay uno cerrado).
// Solo cifras: no envía correos.

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

export type CashTx = { fecha: string; monto: number; tipo: string; categoria?: string | null }

export type MonthlySummary = {
  year: number
  month: number
  label: string
  expenses: number
  prevExpenses: number
  expensesDelta: number
  income: number
  savings: number
  prevSavings: number
  savingsDelta: number
  netWorth: number
  prevNetWorth: number | null
  netWorthDelta: number | null
  improved: boolean
  expenseHistory: number[]
  savingsHistory: number[]
}

function isIgnored(tx: CashTx): boolean {
  const cat = (tx.categoria ?? "").trim().toLowerCase()
  return cat === "saldo inicial" || cat === "ajuste de saldo"
}

function monthKey(fecha: string): string | null {
  return /^\d{4}-\d{2}/.test(fecha) ? fecha.slice(0, 7) : null
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function totalsFor(transactions: CashTx[], key: string): { income: number; expenses: number; savings: number } {
  let income = 0, expenses = 0
  for (const tx of transactions) {
    if (isIgnored(tx) || monthKey(tx.fecha) !== key) continue
    const amount = Number(tx.monto)
    if (!Number.isFinite(amount)) continue
    if (tx.tipo === "ingreso") income += amount
    else if (tx.tipo === "gasto") expenses += amount
  }
  income = Math.round(income * 100) / 100
  expenses = Math.round(expenses * 100) / 100
  return { income, expenses, savings: Math.round((income - expenses) * 100) / 100 }
}

function labelOf(key: string): { year: number; month: number; label: string } {
  const [year, month] = key.split("-").map(Number)
  const name = MONTHS[month - 1] ?? key
  return { year, month: month - 1, label: `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}` }
}

/** `netWorthByMonth` son cierres YYYY-MM → patrimonio al final de ese mes. */
export function buildMonthlySummary(input: {
  transactions: CashTx[]
  netWorthNow: number
  netWorthByMonth?: Record<string, number>
  today?: string
}): MonthlySummary {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const current = monthKey(today) ?? today.slice(0, 7)
  const previous = shiftMonth(current, -1)
  const hasPrev = input.transactions.some((tx) => !isIgnored(tx) && monthKey(tx.fecha) === previous)
  const key = hasPrev ? previous : current
  const prevKey = shiftMonth(key, -1)
  const cur = totalsFor(input.transactions, key)
  const prev = totalsFor(input.transactions, prevKey)
  const historyKeys = [shiftMonth(key, -5), shiftMonth(key, -4), shiftMonth(key, -3), shiftMonth(key, -2), prevKey, key]
  const map = input.netWorthByMonth ?? {}
  const netWorth = key === current ? input.netWorthNow : (map[key] ?? input.netWorthNow)
  const prevNetWorth = map[prevKey] ?? null
  const netWorthDelta = prevNetWorth === null ? null : Math.round((netWorth - prevNetWorth) * 100) / 100
  const expensesDelta = Math.round((cur.expenses - prev.expenses) * 100) / 100
  const savingsDelta = Math.round((cur.savings - prev.savings) * 100) / 100
  const improved = (netWorthDelta ?? 0) > 0 || cur.expenses < prev.expenses || cur.savings > prev.savings
  return {
    ...labelOf(key),
    expenses: cur.expenses,
    prevExpenses: prev.expenses,
    expensesDelta,
    income: cur.income,
    savings: cur.savings,
    prevSavings: prev.savings,
    savingsDelta,
    netWorth: Math.round(netWorth * 100) / 100,
    prevNetWorth,
    netWorthDelta,
    improved,
    expenseHistory: historyKeys.map((k) => totalsFor(input.transactions, k).expenses),
    savingsHistory: historyKeys.map((k) => totalsFor(input.transactions, k).savings),
  }
}

export function moneyDelta(value: number): string {
  const abs = Math.abs(value).toLocaleString("es-ES", { style: "currency", currency: "EUR" })
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}
