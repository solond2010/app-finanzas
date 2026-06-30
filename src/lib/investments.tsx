"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { addMonths, addWeeks, format, parseISO } from "date-fns"
import { supabase } from "./supabase"
import { USER_ID } from "./store"

export type AssetKind = "stock" | "fund" | "crypto" | "custom"

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
  dca?: boolean
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
  dca: boolean | null
}

export interface WatchItem { symbol: string; name: string }

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

interface InvestmentsContextValue {
  positions: Position[]
  add: (p: Omit<Position, "id">) => string
  update: (p: Position) => void
  remove: (id: string) => void
  watchlist: WatchItem[]
  addWatch: (w: WatchItem) => void
  removeWatch: (symbol: string) => void
  dcaPlans: Record<string, DcaPlan>
  setDcaPlan: (positionId: string, plan: DcaPlan | null) => void
  applyDca: (positionId: string, price: number) => number
}

const InvestmentsContext = createContext<InvestmentsContextValue | null>(null)
const STORAGE_KEY = "app-finanzas-investments"
const WATCH_KEY = "app-finanzas-watchlist"
const DCA_KEY = "app-finanzas-dca"

function toRow(p: Position): InvestmentRow & { user_id: string } {
  return {
    id: p.id, kind: p.kind, symbol: p.symbol, name: p.name, isin: p.isin ?? null,
    date: p.date, units: p.units, buy_price: p.buyPrice, currency: p.currency,
    account_id: p.accountId ?? null, dca: p.dca ?? false, user_id: USER_ID,
  }
}

function fromRow(r: InvestmentRow): Position {
  return {
    id: r.id, kind: r.kind, symbol: r.symbol, name: r.name, isin: r.isin ?? undefined,
    date: r.date, units: Number(r.units), buyPrice: Number(r.buy_price), currency: r.currency,
    accountId: r.account_id ?? undefined, dca: r.dca ?? false,
  }
}

export function InvestmentsProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([])
  const [watchlist, setWatchlist] = useState<WatchItem[]>([])
  const [dcaPlans, setDcaPlans] = useState<Record<string, DcaPlan>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DCA_KEY)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDcaPlans(JSON.parse(raw) as Record<string, DcaPlan>)
    } catch {
      // ignore corrupt storage
    }
  }, [])

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
        const { data, error } = await supabase.from("watchlist").select("*")
        if (!error && data) {
          if (data.length === 0 && localWatch.length > 0) {
            await supabase.from("watchlist").upsert(localWatch.map((w) => ({ symbol: w.symbol, name: w.name, user_id: USER_ID })))
          } else {
            const remote = (data as { symbol: string; name: string }[]).map((w) => ({ symbol: w.symbol, name: w.name }))
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
      try {
        const { data, error } = await supabase.from("investments").select("*")
        if (error || !data) return
        if (data.length === 0 && local.length > 0) {
          // La tabla existe pero está vacía: migra lo que había en localStorage.
          await supabase.from("investments").upsert(local.map(toRow))
        } else {
          const remote = (data as InvestmentRow[]).map(fromRow)
          setPositions(remote)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)) } catch {}
        }
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
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const pos: Position = { ...p, id }
    persistLocal([...positions, pos])
    supabase.from("investments").upsert([toRow(pos)]).then(() => {}, () => {})
    return id
  }

  const update = (pos: Position) => {
    persistLocal(positions.map((x) => (x.id === pos.id ? pos : x)))
    supabase.from("investments").upsert([toRow(pos)]).then(() => {}, () => {})
  }

  const remove = (id: string) => {
    persistLocal(positions.filter((x) => x.id !== id))
    supabase.from("investments").delete().eq("id", id).then(() => {}, () => {})
  }

  const persistWatch = (next: WatchItem[]) => {
    setWatchlist(next)
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)) } catch {}
  }
  const addWatch = (w: WatchItem) => {
    if (watchlist.some((x) => x.symbol === w.symbol)) return
    persistWatch([...watchlist, w])
    supabase.from("watchlist").upsert([{ symbol: w.symbol, name: w.name, user_id: USER_ID }]).then(() => {}, () => {})
  }
  const removeWatch = (symbol: string) => {
    persistWatch(watchlist.filter((x) => x.symbol !== symbol))
    supabase.from("watchlist").delete().eq("symbol", symbol).then(() => {}, () => {})
  }

  const persistDca = (next: Record<string, DcaPlan>) => {
    setDcaPlans(next)
    try { localStorage.setItem(DCA_KEY, JSON.stringify(next)) } catch {}
  }
  const setDcaPlan = (positionId: string, plan: DcaPlan | null) => {
    const next = { ...dcaPlans }
    if (plan) next[positionId] = plan
    else delete next[positionId]
    persistDca(next)
  }
  // Aplica los aportes vencidos al precio actual: suma participaciones y recalcula
  // el precio medio ponderado. Devuelve el nº de aportes aplicados.
  const applyDca = (positionId: string, price: number): number => {
    const plan = dcaPlans[positionId]
    const pos = positions.find((p) => p.id === positionId)
    if (!plan || !pos || !price || price <= 0) return 0
    const due = dcaPendingDates(plan)
    if (due.length === 0) return 0
    const totalAmount = due.length * plan.amount
    const unitsAdded = totalAmount / price
    const newUnits = pos.units + unitsAdded
    const newBuyPrice = newUnits > 0 ? (pos.units * pos.buyPrice + totalAmount) / newUnits : pos.buyPrice
    update({ ...pos, units: newUnits, buyPrice: newBuyPrice })
    const lastDate = due[due.length - 1]
    setDcaPlan(positionId, { ...plan, last: format(lastDate, "yyyy-MM-dd") })
    return due.length
  }

  return <InvestmentsContext.Provider value={{ positions, add, update, remove, watchlist, addWatch, removeWatch, dcaPlans, setDcaPlan, applyDca }}>{children}</InvestmentsContext.Provider>
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

  return { positions, quotes, loading, value, invested, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0, valueByAccount }
}
