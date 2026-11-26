// Tarjeta «Compartir mi mes»: las cifras salen del mismo resumen mensual
// (countsTowardCashFlow, sin traspasos ni ajustes de saldo). Solo lectura.

import { countsTowardCashFlow, getSavingsRate, reportingAmount, type CurrencyByAccount } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { moneyDelta, signedPercentDelta, type CashTx, type MonthlySummary, buildMonthlySummary } from "@/lib/billing/monthly-summary"
import type { Transaction } from "@/lib/store"

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

const BLOCKED_NAME = /(?:^|[\s._+-])(moha|mohamed|mohammed)(?:$|[\s._+-])/i
const BLOCKED_BRAND = /tigre\s*aprende|tigreaprende|@?mohaat|x\.com\/moha/i

export const SHARE_MONTH_WIDTH = 1080
export const SHARE_MONTH_HEIGHT = 1350
export const SHARE_MONTH_FOOTER = "Hecho con Garra · migarra.app"

export type ShareSlice = {
  name: string
  amount: number
  pct: number
}

export type ShareMonthHistoryPoint = {
  key: string
  label: string
  income: number
  expenses: number
  net: number
}

export type ShareMonthCard = MonthlySummary & {
  displayName: string | null
  incomeSources: ShareSlice[]
  topExpense: ShareSlice | null
  savingsRate: number
  history: ShareMonthHistoryPoint[]
}

export type ShareMonthView = {
  monthName: string
  year: number
  label: string
  displayName: string | null
  incomeText: string
  incomeDeltaText: string
  incomeDeltaPctText: string | null
  incomeUp: boolean
  sources: { name: string; amountText: string; pctText: string; weight: number }[]
  incomeMetric: string
  expensesMetric: string
  netMetric: string
  netPositive: boolean
  history: ShareMonthHistoryPoint[]
  savingsRate: number
  savingsRateText: string
  topExpense: { name: string; amountText: string; pctText: string } | null
  footer: string
}


export function formatDeltaPct(pct: number | null): string | null {
  if (pct === null) return null
  const abs = Math.abs(pct)
  const body = abs.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 0 })
  if (pct > 0) return `+${body} %`
  if (pct < 0) return `−${body} %`
  return "0 %"
}

/** Leyenda de una fuente: «Nómina 2.100,00 € (85,7 %)», con el mismo euro que el resto. */
export function shareSourceLegend(source: { name: string; amountText: string; pctText: string }): string {
  return `${source.name} ${source.amountText} (${source.pctText})`
}

function foldName(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim()
}

export function isBlockedShareName(value: string): boolean {
  const folded = foldName(value)
  return BLOCKED_NAME.test(folded) || BLOCKED_BRAND.test(folded) || BLOCKED_BRAND.test(value)
}

/** Nombre visible en la imagen: el del perfil, nunca el de Moha ni marcas ajenas. */
export function shareDisplayName(input: { name?: string | null; email?: string | null }): string | null {
  const raw = (input.name ?? "").replace(/\s+/g, " ").trim()
  if (!raw || isBlockedShareName(raw)) return null
  if (raw.length > 48) return `${raw.slice(0, 47).trim()}…`
  return raw
}

export function rawProfileName(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata) return null
  for (const key of ["full_name", "name", "display_name", "given_name"] as const) {
    const value = metadata[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
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

function isIgnored(tx: CashTx): boolean {
  const cat = (tx.categoria ?? "").trim().toLowerCase()
  return cat === "saldo inicial" || cat === "ajuste de saldo"
}

function slicesFor(
  transactions: CashTx[],
  key: string,
  tipo: "ingreso" | "gasto",
  currencies?: CurrencyByAccount,
): ShareSlice[] {
  const all = transactions.map(asTransaction)
  const buckets = new Map<string, number>()
  let total = 0
  for (let i = 0; i < transactions.length; i++) {
    const raw = transactions[i]!
    const tx = all[i]!
    if (isIgnored(raw) || !raw.fecha.startsWith(key)) continue
    if (!countsTowardCashFlow(tx, all)) continue
    if (tx.tipo !== tipo) continue
    const amount = reportingAmount(tx, currencies)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const name = (raw.categoria ?? "").trim() || "Sin categoría"
    buckets.set(name, (buckets.get(name) ?? 0) + amount)
    total += amount
  }
  if (total <= 0) return []
  const rows = [...buckets.entries()]
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount)
  const top = rows.slice(0, 4)
  const rest = rows.slice(4)
  const other = rest.reduce((sum, row) => sum + row.amount, 0)
  if (other > 0) top.push({ name: "Otros", amount: Math.round(other * 100) / 100 })
  return top.map((row) => ({
    ...row,
    pct: Math.round((row.amount / total) * 1000) / 10,
  }))
}

function monthNameOf(monthIndex: number): string {
  const name = MONTHS[monthIndex] ?? ""
  return `${name.charAt(0).toUpperCase()}${name.slice(1)}`
}

export function buildShareMonth(input: {
  transactions: CashTx[]
  netWorthNow: number
  netWorthByMonth?: Record<string, number>
  currencies?: CurrencyByAccount
  today?: string
  name?: string | null
  email?: string | null
}): ShareMonthCard {
  const summary = buildMonthlySummary(input)
  const incomeSources = slicesFor(input.transactions, summary.key, "ingreso", input.currencies)
  const expenseSlices = slicesFor(input.transactions, summary.key, "gasto", input.currencies)
  const history: ShareMonthHistoryPoint[] = summary.historyKeys.map((key, index) => {
    const month = Number(key.split("-")[1])
    return {
      key,
      label: SHORT_MONTHS[(month ?? 1) - 1] ?? key,
      income: summary.incomeHistory[index] ?? 0,
      expenses: summary.expenseHistory[index] ?? 0,
      net: summary.savingsHistory[index] ?? 0,
    }
  })
  return {
    ...summary,
    displayName: shareDisplayName({ name: input.name, email: input.email }),
    incomeSources,
    topExpense: expenseSlices[0] ?? null,
    savingsRate: getSavingsRate(summary.income, summary.savings),
    history,
  }
}

function eur(value: number): string {
  return formatMoney(value, "EUR")
}

export function shareMonthView(card: ShareMonthCard): ShareMonthView {
  return {
    monthName: monthNameOf(card.month),
    year: card.year,
    label: card.label,
    displayName: card.displayName,
    incomeText: eur(card.income),
    incomeDeltaText: moneyDelta(card.incomeDelta),
    incomeDeltaPctText: formatDeltaPct(card.incomeDeltaPct),
    incomeUp: card.incomeDelta >= 0,
    sources: card.incomeSources.map((slice) => ({
      name: slice.name,
      amountText: eur(slice.amount),
      pctText: `${slice.pct.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`,
      weight: Math.max(slice.amount, 0),
    })),
    incomeMetric: eur(card.income),
    expensesMetric: eur(card.expenses),
    netMetric: eur(card.savings),
    netPositive: card.savings >= 0,
    history: card.history,
    savingsRate: card.savingsRate,
    savingsRateText: `${card.savingsRate.toLocaleString("es-ES")} %`,
    topExpense: card.topExpense
      ? {
          name: card.topExpense.name,
          amountText: eur(card.topExpense.amount),
          pctText: `${card.topExpense.pct.toLocaleString("es-ES", { maximumFractionDigits: 1 })} %`,
        }
      : null,
    footer: SHARE_MONTH_FOOTER,
  }
}

export function shareMonthFileName(label: string): string {
  const slug = label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
  return `garra-mi-mes-${slug || "mes"}.png`
}

/** Datos inventados para la imagen de ejemplo. No pertenecen a nadie real. */
export function exampleShareMonthView(): ShareMonthView {
  const card: ShareMonthCard = {
    year: 2026,
    month: 9,
    key: "2026-10",
    prevKey: "2026-09",
    label: "Octubre 2026",
    heading: "Resumen de octubre",
    expenses: 980,
    prevExpenses: 1040,
    expensesDelta: -60,
    income: 2450,
    prevIncome: 2270,
    incomeDelta: 180,
    incomeDeltaPct: 7.9,
    savings: 1470,
    prevSavings: 1230,
    savingsDelta: 240,
    netWorth: 0,
    prevNetWorth: null,
    netWorthDelta: null,
    improved: true,
    historyKeys: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
    expenseHistory: [1100, 1020, 990, 1010, 1040, 980],
    incomeHistory: [2200, 2200, 2300, 2310, 2270, 2450],
    savingsHistory: [1100, 1180, 1310, 1300, 1230, 1470],
    displayName: "Lara Gil",
    incomeSources: [
      { name: "Nómina", amount: 2100, pct: 85.7 },
      { name: "Freelance", amount: 350, pct: 14.3 },
    ],
    topExpense: { name: "Vivienda", amount: 520, pct: 53.1 },
    savingsRate: getSavingsRate(2450, 1470),
    history: [
      { key: "2026-05", label: "may", income: 2200, expenses: 1100, net: 1100 },
      { key: "2026-06", label: "jun", income: 2200, expenses: 1020, net: 1180 },
      { key: "2026-07", label: "jul", income: 2300, expenses: 990, net: 1310 },
      { key: "2026-08", label: "ago", income: 2310, expenses: 1010, net: 1300 },
      { key: "2026-09", label: "sep", income: 2270, expenses: 1040, net: 1230 },
      { key: "2026-10", label: "oct", income: 2450, expenses: 980, net: 1470 },
    ],
  }
  return shareMonthView(card)
}
