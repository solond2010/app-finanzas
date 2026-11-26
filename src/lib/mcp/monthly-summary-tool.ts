// Resumen mensual de solo lectura para el MCP. Usa las mismas reglas de
// caja que la app (countsTowardCashFlow, sin traspasos ni ajustes).

import { dateKeyInTimeZone } from "@/lib/date-utils"
import { countsTowardCashFlow, getCurrencyByAccount, reportingAmount, type CurrencyByAccount } from "@/lib/calculations"
import type { CurrencyCode } from "@/lib/currency"
import { buildMonthlySummary, type CashTx } from "@/lib/billing/monthly-summary"
import type { Transaction } from "@/lib/store"
import type { McpCashFlowTx, McpStore, ToolResult } from "@/lib/mcp/tools"

export type MonthlyCategorySlice = {
  name: string
  amount: number
}

export type McpMonthlySummary = {
  month: string
  label: string
  income: number
  expenses: number
  net: number
  previous: { month: string; income: number; expenses: number; net: number }
  incomeDelta: number
  expensesDelta: number
  netDelta: number
  incomeByCategory: MonthlyCategorySlice[]
  expensesByCategory: MonthlyCategorySlice[]
}

/** Mes YYYY-MM. Si falta, el mes actual en Europe/Madrid. */
export function parseMonthKey(value: unknown, now = new Date()): string | null {
  if (value === undefined || value === null || value === "") {
    return dateKeyInTimeZone(now, "Europe/Madrid").slice(0, 7)
  }
  if (typeof value !== "string" || !/^\d{4}-\d{2}$/.test(value)) return null
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) return null
  return value
}

function isIgnoredCashCategory(categoria?: string | null): boolean {
  const cat = (categoria ?? "").trim().toLowerCase()
  return cat === "saldo inicial" || cat === "ajuste de saldo"
}

function toCashTransaction(row: CashTx, index: number): Transaction {
  return {
    id: row.id || `tmp_${index}`,
    cuenta_id: row.cuenta_id ?? "",
    monto: Number(row.monto),
    fecha: row.fecha,
    tipo: row.tipo === "ingreso" ? "ingreso" : "gasto",
    categoria: row.categoria ?? "",
    es_necesidad: false,
    descripcion: "",
    tags: Array.isArray(row.tags) ? row.tags : [],
  }
}

function categoryBreakdown(
  transactions: CashTx[],
  month: string,
  tipo: "ingreso" | "gasto",
  currencies?: CurrencyByAccount,
): MonthlyCategorySlice[] {
  const all = transactions.map(toCashTransaction)
  const buckets = new Map<string, number>()
  for (let i = 0; i < transactions.length; i++) {
    const raw = transactions[i]!
    const tx = all[i]!
    if (isIgnoredCashCategory(raw.categoria) || !raw.fecha.startsWith(month)) continue
    if (!countsTowardCashFlow(tx, all)) continue
    if (tx.tipo !== tipo) continue
    const amount = reportingAmount(tx, currencies)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const name = (raw.categoria ?? "").trim() || "Sin categoría"
    buckets.set(name, Math.round(((buckets.get(name) ?? 0) + amount) * 100) / 100)
  }
  return [...buckets.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export async function getMonthlySummaryTool(
  store: McpStore,
  userId: string,
  args: { month?: unknown } = {},
  now = new Date(),
): Promise<ToolResult<McpMonthlySummary>> {
  const month = parseMonthKey(args.month, now)
  if (!month) return { ok: false, status: 400, error: "month debe tener el formato YYYY-MM" }

  const [rows, accounts] = await Promise.all([
    store.listCashFlowTransactions(userId),
    store.listAccounts(userId),
  ])
  const currencies = getCurrencyByAccount(accounts.map((account) => ({ id: account.id, currency: (account.currency || "EUR") as CurrencyCode })))
  const transactions: CashTx[] = rows.map((row) => ({
    id: row.id,
    cuenta_id: row.cuenta_id,
    monto: Number(row.monto),
    fecha: row.fecha,
    tipo: row.tipo,
    categoria: row.categoria,
    tags: Array.isArray(row.tags) ? row.tags : [],
  }))
  const today = dateKeyInTimeZone(now, "Europe/Madrid")
  const summary = buildMonthlySummary({
    transactions,
    netWorthNow: 0,
    currencies,
    today,
    month,
  })
  return {
    ok: true,
    data: {
      month: summary.key,
      label: summary.label,
      income: summary.income,
      expenses: summary.expenses,
      net: summary.savings,
      previous: {
        month: summary.prevKey,
        income: summary.prevIncome,
        expenses: summary.prevExpenses,
        net: summary.prevSavings,
      },
      incomeDelta: summary.incomeDelta,
      expensesDelta: summary.expensesDelta,
      netDelta: summary.savingsDelta,
      incomeByCategory: categoryBreakdown(transactions, summary.key, "ingreso", currencies),
      expensesByCategory: categoryBreakdown(transactions, summary.key, "gasto", currencies),
    },
  }
}
