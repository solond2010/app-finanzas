import { countsTowardCashFlow, reportingAmount, type CurrencyByAccount } from "@/lib/calculations"
import type { Transaction } from "@/lib/store"
import { type CashTx } from "./monthly-summary"

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

function savingsIn(transactions: CashTx[], key: string, currencies?: CurrencyByAccount): { savings: number; active: boolean } {
  const all = transactions.map(asTransaction)
  let income = 0, expenses = 0, active = false
  for (let i = 0; i < transactions.length; i++) {
    const raw = transactions[i]!
    const tx = all[i]!
    if (isIgnored(raw) || monthKey(raw.fecha) !== key) continue
    if (!countsTowardCashFlow(tx, all)) continue
    const amount = reportingAmount(tx, currencies)
    if (!Number.isFinite(amount)) continue
    active = true
    if (tx.tipo === "ingreso") income += amount
    else expenses += amount
  }
  return { savings: Math.round((income - expenses) * 100) / 100, active }
}

/** Media de ahorro de los últimos `count` meses cerrados. Si no hay, usa el mes en curso. */
export function averageMonthlySavings(transactions: CashTx[], today = new Date().toISOString().slice(0, 10), count = 3, currencies?: CurrencyByAccount): number {
  const current = today.slice(0, 7)
  const closed: string[] = []
  for (let i = 1; i <= count; i++) closed.push(shiftMonth(current, -i))
  let points = closed.map((k) => savingsIn(transactions, k, currencies)).filter((p) => p.active)
  if (!points.length) {
    const open = savingsIn(transactions, current, currencies)
    if (open.active) points = [open]
  }
  if (!points.length) return 0
  const sum = points.reduce((s, p) => s + p.savings, 0)
  return Math.round((sum / points.length) * 100) / 100
}

export function projectNetWorth(netWorth: number, monthlyAvg: number, months = 12): number {
  return Math.round((netWorth + monthlyAvg * months) * 100) / 100
}

/** Meses estimados para cubrir `remaining` € al ritmo `monthlyAvg`. Null si no ahorra. */
export function monthsToGoal(remaining: number, monthlyAvg: number): number | null {
  if (!(remaining > 0)) return 0
  if (!(monthlyAvg > 0)) return null
  return Math.max(1, Math.ceil(remaining / monthlyAvg))
}

export function monthsLabel(months: number | null): string | null {
  if (months === null) return null
  if (months <= 0) return "Ya lo tienes"
  if (months === 1) return "un mes"
  return `unos ${months} meses`
}
