"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { addMonths, addWeeks, format, parseISO } from "date-fns"
import { dbSelect, dbUpsert, dbDeleteEq } from "./db-client"
import { USER_ID } from "./store"

export type AssetKind = "stock" | "fund" | "crypto" | "custom"

// Clase de activo para el desglose de asignación (Tipología / informe X-Ray),
// más granular que el `kind` técnico usado para la búsqueda de precios.
export type AssetClass = "acciones" | "fondos_indexados" | "cripto" | "renta_fija" | "roboadvisor" | "oro" | "liquidez" | "otros"

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  acciones: "Acciones",
  fondos_indexados: "Fondos Indexados",
  cripto: "Criptomonedas",
  renta_fija: "Renta Fija",
  roboadvisor: "Roboadvisor",
  oro: "Oro",
  liquidez: "Liquidez",
  otros: "Otros",
}

export function defaultAssetClass(kind: AssetKind): AssetClass {
  if (kind === "stock") return "acciones"
  if (kind === "fund") return "fondos_indexados"
  if (kind === "crypto") return "cripto"
  return "otros"
}

/** Clase de activo efectiva: la elegida por el usuario, o la que corresponde por defecto a su `kind`. */
export function assetClassOf(p: Position): AssetClass {
  return p.assetClass ?? defaultAssetClass(p.kind)
}

export interface Position {
  id: string
  kind: AssetKind
  symbol: string
  name: string
  isin?: string
  date: string
  units: number
  buyPrice: number
  currency: string
  accountId?: string
  assetClass?: AssetClass
  dca?: boolean
  dcaAmount?: number
  dcaFreq?: DcaFreq
  dcaLast?: string
}

interface InvestmentRow {
  id: string
  kind: AssetKind
  symbol: string
  name: string
  isin: string | null
  date: string
  units: number | string
  buy_price: number | string
  currency: string
  account_id: string | null
  asset_class: string | null
  dca: boolean | null
  dca_amount: number | string | null
  dca_freq: string | null
  dca_last: string | null
}

export interface WatchItem { symbol: string; name: string }

/** Un aporte individual a una posición: compra inicial, DCA aplicado o aporte manual. */
export interface Contribution {
  id: string
  positionId: string
  amount: number
  date: string
}

interface ContributionRow {
  id: string
  position_id: string
  amount: number | string
  date: string
}

function contributionToRow(c: Contribution): Record<string, unknown> {
  return { id: c.id, position_id: c.positionId, amount: c.amount, date: c.date, user_id: USER_ID }
}

function contributionFromRow(r: ContributionRow): Contribution {
  return { id: r.id, positionId: r.position_id, amount: Number(r.amount), date: r.date }
}

export type DcaFreq = "monthly" | "weekly"
export interface DcaPlan { amount: number; freq: DcaFreq; last: string }

/** Devuelve las fechas de aportes vencidos (programados <= hoy) desde la última aportación. */
export function dcaPendingDates(plan: DcaPlan, today: Date = new Date()): Date[] {
  const out: Date[] = []
  let cursor = parseISO(plan.last)
  while (out.length < 600) {
    cursor = plan.freq === "weekly" ? addWeeks(cursor, 1) : addMonths(cursor, 1)
    if (cursor.getTime() > today.getTime()) break
    out.push(new Date(cursor))
  }
  return out
}

/** Próxima fecha de aporte programada (futura). */
export function dcaNextDate(plan: DcaPlan): Date {
  const last = parseISO(plan.last)
  return plan.freq === "weekly" ? addWeeks(last, 1) : addMonths(last, 1)
}

/** Plan DCA de una posición (o null si no tiene aportes programados). */
export function planOf(p: Position): DcaPlan | null {
  if (!p.dca || !p.dcaAmount || p.dcaAmount <= 0) return null
  return { amount: p.dcaAmount, freq: p.dcaFreq ?? "monthly", last: p.dcaLast ?? p.date }
}

/** Fusiona una nueva compra en una posición existente del mismo activo/cuenta, recalculando el precio medio ponderado. */
export function mergedPosition(existing: Position, incoming: Omit<Position, "id">): Position {
  const addedCost = incoming.units * incoming.buyPrice
  const newUnits = existing.units + incoming.units
  const newBuyPrice = newUnits > 0 ? (existing.units * existing.buyPrice + addedCost) / newUnits : incoming.buyPrice
  return {
    ...existing,
    units: newUnits,
    buyPrice: newBuyPrice,
    date: incoming.date > existing.date ? incoming.date : existing.date,
    ...(incoming.dca ? { dca: incoming.dca, dcaAmount: incoming.dcaAmount, dcaFreq: incoming.dcaFreq, dcaLast: incoming.dcaLast } : {}),
  }
}

interface InvestmentsContextValue {
  positions: Position[]
  add: (p: Omit<Position, "id">) => { id: string; merged: boolean }
  update: (p: Position) => void
  remove: (id: string) => void
  watchlist: WatchItem[]
  addWatch: (w: WatchItem) => void
  removeWatch: (symbol: string) => void
  applyDca: (positionId: string, price: number) => number
  contributions: Contribution[]
  addContribution: (positionId: string, amount: number, date: string) => void
}

const InvestmentsContext = createContext<InvestmentsContextValue | null>(null)
const STORAGE_KEY = "app-finanzas-investments"
const WATCH_KEY = "app-finanzas-watchlist"
const CONTRIB_KEY = "app-finanzas-contributions"

function toRow(p: Position): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: p.id, kind: p.kind, symbol: p.symbol, name: p.name, isin: p.isin ?? null,
    date: p.date, units: p.units, buy_price: p.buyPrice, currency: p.currency,
    account_id: p.accountId ?? null, dca: p.dca ?? false,
    user_id: USER_ID,
  }
  // Las columnas DCA solo se envían cuando hay plan, para que las posiciones
  // normales sigan sincronizando aunque la migración SQL (supabase-dca.sql) no
  // se haya ejecutado todavía. planOf() filtra por el flag `dca`, así que un plan
  // desactivado se ignora aunque queden valores antiguos en la fila.
  if (p.dcaAmount != null) {
    base.dca_amount = p.dcaAmount
    base.dca_freq = p.dcaFreq ?? null
    base.dca_last = p.dcaLast ?? null
  }
  // A diferencia de DCA, `asset_class` SIEMPRE se envía (aunque coincida con el
  // valor por defecto de su `kind`, o sea null): si solo se enviara cuando
  // difiere del default, reclasificar una posición de vuelta a su clase por
  // defecto no se guardaba y la fila en Supabase se quedaba con el valor
  // anterior, que volvía a aparecer en el próximo `fromRow`. Requiere haber
  // corrido supabase-assetclass.sql (si no, el upsert entero fallaría).
  base.asset_class = p.assetClass ?? null
  return base
}

function fromRow(r: InvestmentRow): Position {
  return {
    id: r.id, kind: r.kind, symbol: r.symbol, name: r.name, isin: r.isin ?? undefined,
    date: r.date, units: Number(r.units), buyPrice: Number(r.buy_price), currency: r.currency,
    accountId: r.account_id ?? undefined, dca: r.dca ?? false,
    assetClass: (r.asset_class as AssetClass | null) ?? undefined,
    dcaAmount: r.dca_amount != null ? Number(r.dca_amount) : undefined,
    dcaFreq: (r.dca_freq as DcaFreq | null) ?? undefined,
    dcaLast: r.dca_last ?? undefined,
  }
}

export function InvestmentsProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [contributions, setContributions] = useState<Contribution[]>([])

  useEffect(() => {
    queueMicrotask(async () => {
      let localWatch: WatchItem[] = []
      try {
        const wraw = localStorage.getItem(WATCH_KEY)
        if (wraw) { localWatch = JSON.parse(wraw) as WatchItem[]; setWatchlist(localWatch) }
      } catch {
        // ignore
      }
      try {
        const data = await dbSelect<{ symbol: string; name: string }>("watchlist")
        if (data) {
          if (data.length === 0 && localWatch.length > 0) {
            await dbUpsert("watchlist", localWatch.map((w) => ({ symbol: w.symbol, name: w.name, user_id: USER_ID })))
          } else {
            const remote = data.map((w) => ({ symbol: w.symbol, name: w.name }))
            setWatchlist(remote)
            try { localStorage.setItem(WATCH_KEY, JSON.stringify(remote)) } catch {}
          }
        }
      } catch {
        // sin tabla / sin red → seguimos solo con localStorage
      }
      let local: Position[] = []
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) { local = JSON.parse(raw) as Position[]; setPositions(local) }
      } catch {
        // ignore corrupt storage
      }
      let loadedPositions: Position[] = local
      try {
        const data = await dbSelect<InvestmentRow>("investments")
        if (!data) return
        if (data.length === 0 && local.length > 0) {
          // La tabla existe pero está vacía: migra lo que había en localStorage.
          await dbUpsert("investments", local.map(toRow))
        } else {
          const remote = data.map(fromRow)
          loadedPositions = remote
          setPositions(remote)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)) } catch {}
        }
      } catch {
        // Sin tabla / sin red → seguimos solo con localStorage.
      }

      let localContrib: Contribution[] = []
      try {
        const craw = localStorage.getItem(CONTRIB_KEY)
        if (craw) { localContrib = JSON.parse(craw) as Contribution[]; setContributions(localContrib) }
      } catch {
        // ignore corrupt storage
      }
      try {
        const data = await dbSelect<ContributionRow>("investment_contributions")
        if (!data) return
        let remote = data.map(contributionFromRow)
        // Backfill: cada posición sin ningún aporte registrado (típicamente porque
        // ya existía antes de esta función) recibe uno inicial con su compra
        // original, para que el histórico mensual no empiece vacío.
        const missing = loadedPositions
          .filter((p) => !remote.some((c) => c.positionId === p.id))
          .map((p) => ({
            id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            positionId: p.id,
            amount: p.units * p.buyPrice,
            date: p.date,
          }))
        if (missing.length > 0) {
          await dbUpsert("investment_contributions", missing.map(contributionToRow))
          remote = [...remote, ...missing]
        }
        setContributions(remote)
        try { localStorage.setItem(CONTRIB_KEY, JSON.stringify(remote)) } catch {}
      } catch {
        // Sin tabla / sin red → seguimos solo con localStorage.
      }
    })
  }, [])

  const persistLocal = (next: Position[]) => {
    setPositions(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }

  const add = (p: Omit<Position, "id">) => {
    // Comprar más de un activo que ya tienes en la misma cuenta no debe crear
    // una posición duplicada: se fusiona en la existente recalculando el
    // precio medio ponderado (mismo cálculo que applyDca para los aportes DCA).
    const existing = positions.find((x) => x.symbol === p.symbol && x.accountId === p.accountId)
    if (existing) {
      const merged = mergedPosition(existing, p)
      update(merged)
      const addedCost = p.units * p.buyPrice
      if (addedCost > 0) addContribution(existing.id, addedCost, p.date)
      return { id: existing.id, merged: true }
    }
    // eslint-disable-next-line react-hooks/purity -- event-handler code, not render; needs a fresh id per call
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const pos: Position = { ...p, id }
    persistLocal([...positions, pos])
    dbUpsert("investments", [toRow(pos)]).then(() => {}, () => {})
    if (pos.units * pos.buyPrice > 0) addContribution(id, pos.units * pos.buyPrice, pos.date)
    return { id, merged: false }
  }

  const update = (pos: Position) => {
    persistLocal(positions.map((x) => (x.id === pos.id ? pos : x)))
    dbUpsert("investments", [toRow(pos)]).then(() => {}, () => {})
  }

  const remove = (id: string) => {
    persistLocal(positions.filter((x) => x.id !== id))
    dbDeleteEq("investments", "id", id).then(() => {}, () => {})
  }

  const persistWatch = (next: WatchItem[]) => {
    setWatchlist(next)
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)) } catch {}
  }
  const addWatch = (w: WatchItem) => {
    if (watchlist.some((x) => x.symbol === w.symbol)) return
    persistWatch([...watchlist, w])
    dbUpsert("watchlist", [{ symbol: w.symbol, name: w.name, user_id: USER_ID }]).then(() => {}, () => {})
  }
  const removeWatch = (symbol: string) => {
    persistWatch(watchlist.filter((x) => x.symbol !== symbol))
    dbDeleteEq("watchlist", "symbol", symbol).then(() => {}, () => {})
  }

  const persistContrib = (next: Contribution[]) => {
    setContributions(next)
    try { localStorage.setItem(CONTRIB_KEY, JSON.stringify(next)) } catch {}
  }
  const addContribution = (positionId: string, amount: number, date: string) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const c: Contribution = { id, positionId, amount, date }
    persistContrib([...contributions, c])
    dbUpsert("investment_contributions", [contributionToRow(c)]).then(() => {}, () => {})
  }

  // Aplica los aportes vencidos al precio actual: suma participaciones, recalcula
  // el precio medio ponderado y avanza la fecha de la última aportación. Todo se
  // guarda en la posición (tabla `investments`). Devuelve el nº de aportes aplicados.
  const applyDca = (positionId: string, price: number): number => {
    const pos = positions.find((p) => p.id === positionId)
    const plan = pos ? planOf(pos) : null
    if (!pos || !plan || !price || price <= 0) return 0
    const due = dcaPendingDates(plan)
    if (due.length === 0) return 0
    const totalAmount = due.length * plan.amount
    const unitsAdded = totalAmount / price
    const newUnits = pos.units + unitsAdded
    const newBuyPrice = newUnits > 0 ? (pos.units * pos.buyPrice + totalAmount) / newUnits : pos.buyPrice
    const lastDate = format(due[due.length - 1], "yyyy-MM-dd")
    update({ ...pos, units: newUnits, buyPrice: newBuyPrice, dcaLast: lastDate })
    for (const d of due) addContribution(positionId, plan.amount, format(d, "yyyy-MM-dd"))
    return due.length
  }

  return <InvestmentsContext.Provider value={{ positions, add, update, remove, watchlist, addWatch, removeWatch, applyDca, contributions, addContribution }}>{children}</InvestmentsContext.Provider>
}

export function useInvestments() {
  const ctx = useContext(InvestmentsContext)
  if (!ctx) throw new Error("useInvestments must be used within InvestmentsProvider")
  return ctx
}

interface Quote { price: number; currency: string; changePct?: number | null }

export function usePortfolioValue() {
  const { positions } = useInvestments()
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(false)

  const symbolsKey = useMemo(
    () => [...new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))].sort().join(","),
    [positions]
  )

  useEffect(() => {
    const syms = symbolsKey ? symbolsKey.split(",") : []
    /* eslint-disable react-hooks/set-state-in-effect */
    if (syms.length === 0) { setQuotes({}); return }
    let cancelled = false
    setLoading(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/quote?symbols=${encodeURIComponent(syms.join(","))}`)
      .then((r) => r.json())
      .then((d: { quotes?: Record<string, Quote> }) => { if (!cancelled) setQuotes(d.quotes ?? {}) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbolsKey])

  const priceOf = (p: Position) => (p.kind === "custom" ? p.buyPrice : quotes[p.symbol]?.price ?? p.buyPrice)
  const value = positions.reduce((s, p) => s + p.units * priceOf(p), 0)
  const invested = positions.reduce((s, p) => s + p.units * p.buyPrice, 0)
  const pnl = value - invested

  const valueByAccount = positions.reduce<Record<string, number>>((m, p) => {
    if (p.accountId) m[p.accountId] = (m[p.accountId] ?? 0) + p.units * priceOf(p)
    return m
  }, {})
  // Coste de compra de las posiciones de cada cuenta: junto con el saldo bruto,
  // permite separar "efectivo aún sin invertir" del valor ya invertido (ver
  // accountDisplayValue). Comprar una posición no descuenta su coste del saldo
  // de la cuenta (no genera un gasto), así que sin esto el saldo bruto no dice
  // nada por sí solo una vez hay posiciones de por medio.
  const investedByAccount = positions.reduce<Record<string, number>>((m, p) => {
    if (p.accountId) m[p.accountId] = (m[p.accountId] ?? 0) + p.units * p.buyPrice
    return m
  }, {})

  return { positions, quotes, loading, value, invested, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0, valueByAccount, investedByAccount }
}

/**
 * Valor real de una cuenta para patrimonio/listados: para cuentas normales, su
 * saldo. Para cuentas de inversión con posiciones, el saldo NO refleja lo
 * invertido (comprar una posición no lo descuenta), así que se sustituye la
 * parte ya invertida por el valor de mercado actual, dejando intacto el
 * efectivo restante que todavía no se ha invertido.
 */
export function accountDisplayValue(
  account: { id: string; tipo: string; saldo: number },
  valueByAccount: Record<string, number>,
  investedByAccount: Record<string, number>
): number {
  if (account.tipo !== "inversion") return account.saldo
  const invested = investedByAccount[account.id] ?? 0
  const marketValue = valueByAccount[account.id] ?? invested
  return account.saldo - invested + marketValue
}
