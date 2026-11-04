import { assetClassOf, planOf, ASSET_CLASS_LABELS, type AssetClass, type Contribution, type Position } from "@/lib/investments"
import { convertToEur, type CurrencyCode } from "@/lib/currency"
import type { Account } from "@/lib/store"

// Cálculos de la vista «Inversiones»: lo aportado frente a lo que vale hoy.
// Todo en euros. Sin precio de mercado (activos manuales o sin conexión) se
// usa el precio de compra, así que esa posición cuenta con ganancia 0.

export type Quote = { price: number; currency: string; name?: string; time?: number | null }

const ISIN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/
/** ¿El nombre guardado es en realidad un código (ticker/ISIN) y no un nombre legible? */
export function looksLikeCode(name: string, symbol: string): boolean {
  const n = name.trim()
  if (!n || n === symbol || ISIN.test(n)) return true
  return !/\s/.test(n) && /[0-9.]/.test(n) && n === n.toUpperCase()
}

/** «hace 5 min», «hace 3 h», «hace 2 días» a partir de un instante en segundos. */
export function freshnessLabel(timeSec: number | null | undefined, now: number = Date.now()): string | null {
  if (!timeSec) return null
  const min = Math.max(0, Math.round((now - timeSec * 1000) / 60000))
  if (min < 1) return "ahora"
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? "hace 1 día" : `hace ${d} días`
}

export type PortfolioRow = {
  id: string
  name: string
  code: string | null // ticker o ISIN, en pequeño debajo del nombre
  quoteTime: number | null // segundos; null = sin cotización
  assetClass: AssetClass
  units: number
  avgCost: number // por unidad, en su moneda
  price: number // por unidad, en su moneda (o la de la cotización)
  priceCurrency: string
  invested: number // €
  value: number // €
  gain: number // €
  gainPct: number | null
  hasQuote: boolean
}

export type Portfolio = {
  rows: PortfolioRow[]
  invested: number
  value: number
  gain: number
  gainPct: number | null
  allocation: { assetClass: AssetClass; label: string; value: number; pct: number }[]
  monthlyPlan: number
  months: { key: string; amount: number }[]
}

export function toEur(amount: number, currency: string): number {
  const eur = convertToEur(amount, currency as CurrencyCode)
  return Number.isFinite(eur) ? eur : amount
}

const round2 = (n: number) => Math.round(n * 100) / 100

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

export function computePortfolio(positions: Position[], quotes: Record<string, Quote | undefined>, contributions: Contribution[], today: Date = new Date()): Portfolio {
  const rows: PortfolioRow[] = positions.map((p) => {
    const q = p.kind === "custom" ? undefined : quotes[p.symbol]
    const hasQuote = !!q && Number.isFinite(q.price) && q.price > 0
    const invested = toEur(p.units * p.buyPrice, p.currency)
    const value = hasQuote ? toEur(p.units * q!.price, q!.currency || p.currency) : invested
    const gain = value - invested
    return {
      id: p.id, name: looksLikeCode(p.name || "", p.symbol) && q?.name ? q.name : p.name || p.symbol,
      code: p.kind === "custom" ? null : p.isin && p.isin !== p.symbol ? `${p.symbol} · ${p.isin}` : p.symbol,
      quoteTime: hasQuote ? q!.time ?? null : null, assetClass: assetClassOf(p), units: p.units, avgCost: p.buyPrice,
      price: hasQuote ? q!.price : p.buyPrice, priceCurrency: hasQuote ? q!.currency || p.currency : p.currency,
      invested: round2(invested), value: round2(value), gain: round2(gain), gainPct: invested > 0 ? (gain / invested) * 100 : null, hasQuote,
    }
  }).sort((a, b) => b.value - a.value)

  const invested = rows.reduce((s, r) => s + r.invested, 0)
  const value = rows.reduce((s, r) => s + r.value, 0)

  const byClass = new Map<AssetClass, number>()
  for (const r of rows) byClass.set(r.assetClass, (byClass.get(r.assetClass) ?? 0) + r.value)
  const allocation = [...byClass.entries()]
    .filter(([, v]) => v > 0)
    .map(([assetClass, v]) => ({ assetClass, label: ASSET_CLASS_LABELS[assetClass], value: round2(v), pct: value > 0 ? (v / value) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)

  const monthlyPlan = positions.reduce((s, p) => {
    const plan = planOf(p)
    if (!plan) return s
    return s + toEur(plan.freq === "weekly" ? (plan.amount * 52) / 12 : plan.amount, p.currency)
  }, 0)

  // Últimos 12 meses de aportaciones. Si una posición no tiene aportes
  // apuntados, cuenta su compra inicial.
  const months: { key: string; amount: number }[] = []
  for (let i = 11; i >= 0; i--) months.push({ key: monthKey(new Date(today.getFullYear(), today.getMonth() - i, 1)), amount: 0 })
  const index = new Map(months.map((m, i) => [m.key, i]))
  const byId = new Map(positions.map((p) => [p.id, p]))
  const withContribs = new Set(contributions.map((c) => c.positionId))
  const add = (date: string, amount: number) => {
    const i = index.get(date.slice(0, 7))
    if (i !== undefined && Number.isFinite(amount)) months[i].amount += amount
  }
  for (const c of contributions) { const p = byId.get(c.positionId); if (p) add(c.date, toEur(c.amount, p.currency)) }
  for (const p of positions) if (!withContribs.has(p.id)) add(p.date, toEur(p.units * p.buyPrice, p.currency))
  for (const m of months) m.amount = round2(m.amount)

  return { rows, invested: round2(invested), value: round2(value), gain: round2(value - invested), gainPct: invested > 0 ? ((value - invested) / invested) * 100 : null, allocation, monthlyPlan: round2(monthlyPlan), months }
}

// ── Inversiones por cuenta ────────────────────────────────────────────────
// El saldo de cada cuenta de inversión (el mismo que en Cuentas) es la única
// fuente de verdad del total. Las posiciones solo reparten ese dinero; lo que
// no está en ninguna posición queda «Sin asignar». Así nunca se cuenta dos veces.

export type SliceKey = AssetClass | "sin_asignar"

export type InvestmentAccountView = {
  id: string
  name: string
  bank: string
  color: string
  balance: number // €
  positionsValue: number // €
  unassigned: number // € (nunca negativo)
  over: boolean // las posiciones valen más que el saldo
  rows: PortfolioRow[]
  gain: number
}

export type InvestmentsView = {
  accounts: InvestmentAccountView[]
  orphans: PortfolioRow[] // posiciones sin cuenta (no suman al total)
  total: number
  assigned: number
  unassigned: number
  gain: number
  gainPct: number | null
  allocation: { key: SliceKey; label: string; value: number; pct: number }[]
  monthlyPlan: number
  months: { key: string; amount: number }[]
}

export function computeInvestments(accounts: Account[], positions: Position[], quotes: Record<string, Quote | undefined>, contributions: Contribution[], today: Date = new Date()): InvestmentsView {
  const linked = new Set(positions.map((p) => p.accountId).filter(Boolean))
  const invAccounts = accounts.filter((a) => a.tipo === "inversion" || linked.has(a.id))
  const ids = new Set(invAccounts.map((a) => a.id))
  const all = computePortfolio(positions, quotes, contributions, today)
  const rowById = new Map(all.rows.map((r) => [r.id, r]))
  const byClass = new Map<AssetClass, number>()

  const views = invAccounts.map((a) => {
    const rows = positions.filter((p) => p.accountId === a.id).map((p) => rowById.get(p.id)!).sort((x, y) => y.value - x.value)
    const balance = round2(toEur(a.saldo, a.currency))
    const positionsValue = round2(rows.reduce((s, r) => s + r.value, 0))
    // Si las posiciones valen más que el saldo, se reparten proporcionalmente
    // dentro del saldo para que el reparto siga sumando el total.
    const factor = positionsValue > 0 ? Math.max(0, Math.min(1, balance / positionsValue)) : 0
    for (const r of rows) byClass.set(r.assetClass, (byClass.get(r.assetClass) ?? 0) + r.value * factor)
    return {
      id: a.id, name: a.nombre, bank: a.banco, color: a.color, balance, positionsValue,
      unassigned: round2(Math.max(0, balance - positionsValue)), over: positionsValue > balance + 0.5,
      rows, gain: round2(rows.filter((r) => r.hasQuote).reduce((s, r) => s + r.gain, 0)),
    }
  }).sort((x, y) => y.balance - x.balance)

  const total = round2(views.reduce((s, v) => s + v.balance, 0))
  const unassigned = round2(views.reduce((s, v) => s + v.unassigned, 0))
  const quoted = views.flatMap((v) => v.rows).filter((r) => r.hasQuote)
  const gain = round2(quoted.reduce((s, r) => s + r.gain, 0))
  const quotedInvested = quoted.reduce((s, r) => s + r.invested, 0)
  const slices: { key: SliceKey; label: string; value: number }[] = [...byClass.entries()].map(([k, v]) => ({ key: k, label: ASSET_CLASS_LABELS[k], value: v }))
  if (unassigned > 0) slices.push({ key: "sin_asignar", label: "Sin asignar", value: unassigned })
  const sliceTotal = slices.reduce((s, x) => s + x.value, 0)
  const allocation = slices.filter((x) => x.value > 0.005).map((x) => ({ ...x, value: round2(x.value), pct: sliceTotal > 0 ? (x.value / sliceTotal) * 100 : 0 })).sort((x, y) => y.value - x.value)

  return {
    accounts: views,
    orphans: positions.filter((p) => !p.accountId || !ids.has(p.accountId)).map((p) => rowById.get(p.id)!),
    total, assigned: round2(total - unassigned), unassigned, gain, gainPct: quotedInvested > 0 ? (gain / quotedInvested) * 100 : null,
    allocation, monthlyPlan: all.monthlyPlan, months: all.months,
  }
}

// ── Venta de una posición ─────────────────────────────────────────────────
// El dinero invertido ya está dentro del saldo de la cuenta; al vender solo
// cambia el saldo en la ganancia (o pérdida): venta − coste de lo vendido.

export type SaleResult = { unitsSold: number; remainingUnits: number; full: boolean; costBasis: number; gain: number }

export function computeSale(position: Pick<Position, "units" | "buyPrice" | "currency">, unitsToSell: number, saleAmountEur: number): SaleResult | null {
  if (!Number.isFinite(unitsToSell) || !Number.isFinite(saleAmountEur) || unitsToSell <= 0 || saleAmountEur < 0) return null
  if (unitsToSell > position.units + 1e-9) return null
  const full = position.units - unitsToSell < 1e-9
  const unitsSold = full ? position.units : unitsToSell
  const costBasis = round2(toEur(unitsSold * position.buyPrice, position.currency))
  return { unitsSold, remainingUnits: full ? 0 : Math.round((position.units - unitsSold) * 1e8) / 1e8, full, costBasis, gain: round2(saleAmountEur - costBasis) }
}

/** Total en € de vender `units` a `unitPrice` (en la moneda de la cotización). */
export function saleTotalFromPrice(units: number, unitPrice: number, currency: string): number | null {
  if (!(units > 0) || !(unitPrice >= 0)) return null
  return round2(toEur(units * unitPrice, currency))
}

/** Precio por unidad (en su moneda) que corresponde a un total en €. */
export function unitPriceFromTotal(totalEur: number, units: number, currency: string): number | null {
  if (!(units > 0) || !(totalEur >= 0)) return null
  const perUnitEur = totalEur / units
  const rate = toEur(1, currency)
  return Math.round((rate > 0 ? perUnitEur / rate : perUnitEur) * 10000) / 10000
}
