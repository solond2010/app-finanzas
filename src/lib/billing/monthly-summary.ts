// Resumen del último mes cerrado (o del mes en curso si aún no hay uno cerrado).
// Solo cifras: no envía correos.
// Los gastos/ingresos siguen el mismo criterio que la tarjeta «Gastado este mes»
// (countsTowardCashFlow): no cuentan traspasos emparejados ni ajustes de saldo.

import { countsTowardCashFlow, reportingAmount, type CurrencyByAccount } from "@/lib/calculations"
import type { Transaction } from "@/lib/store"

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

export type CashTx = {
  fecha: string
  monto: number
  tipo: string
  categoria?: string | null
  id?: string
  cuenta_id?: string
  tags?: string[]
}

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

function asTransaction(tx: CashTx, index: number): Transaction {
  return {
    id: tx.id ?? `tmp_${index}`,
    cuenta_id: tx.cuenta_id ?? "",
    monto: tx.monto,
    fecha: tx.fecha,
    tipo: tx.tipo === "ingreso" ? "ingreso" : "gasto",
    categoria: tx.categoria ?? "",
    es_necesidad: false,
    descripcion: "",
    tags: tx.tags ?? [],
  }
}

function totalsFor(transactions: CashTx[], key: string, currencies?: CurrencyByAccount): { income: number; expenses: number; savings: number } {
  const all = transactions.map(asTransaction)
  let income = 0, expenses = 0
  for (let i = 0; i < transactions.length; i++) {
    const raw = transactions[i]!
    const tx = all[i]!
    if (isIgnored(raw) || monthKey(raw.fecha) !== key) continue
    if (!countsTowardCashFlow(tx, all)) continue
    const amount = reportingAmount(tx, currencies)
    if (!Number.isFinite(amount)) continue
    if (tx.tipo === "ingreso") income += amount
    else expenses += amount
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
  currencies?: CurrencyByAccount
  today?: string
}): MonthlySummary {
  const today = input.today ?? new Date().toISOString().slice(0, 10)
  const current = monthKey(today) ?? today.slice(0, 7)
  const previous = shiftMonth(current, -1)
  const hasPrev = input.transactions.some((tx) => !isIgnored(tx) && monthKey(tx.fecha) === previous)
  const key = hasPrev ? previous : current
  const prevKey = shiftMonth(key, -1)
  const currencies = input.currencies
  const cur = totalsFor(input.transactions, key, currencies)
  const prev = totalsFor(input.transactions, prevKey, currencies)
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
    expenseHistory: historyKeys.map((k) => totalsFor(input.transactions, k, currencies).expenses),
    savingsHistory: historyKeys.map((k) => totalsFor(input.transactions, k, currencies).savings),
  }
}

export function moneyDelta(value: number): string {
  const abs = Math.abs(value).toLocaleString("es-ES", { style: "currency", currency: "EUR" })
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}
