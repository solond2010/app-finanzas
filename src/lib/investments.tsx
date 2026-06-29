"use client"

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
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

interface InvestmentsContextValue {
  positions: Position[]
  add: (p: Omit<Position, "id">) => void
  update: (p: Position) => void
  remove: (id: string) => void
}

const InvestmentsContext = createContext<InvestmentsContextValue | null>(null)
const STORAGE_KEY = "app-finanzas-investments"

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

  useEffect(() => {
    queueMicrotask(async () => {
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
  }

  const update = (pos: Position) => {
    persistLocal(positions.map((x) => (x.id === pos.id ? pos : x)))
    supabase.from("investments").upsert([toRow(pos)]).then(() => {}, () => {})
  }

  const remove = (id: string) => {
    persistLocal(positions.filter((x) => x.id !== id))
    supabase.from("investments").delete().eq("id", id).then(() => {}, () => {})
  }

  return <InvestmentsContext.Provider value={{ positions, add, update, remove }}>{children}</InvestmentsContext.Provider>
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

  return { positions, quotes, loading, value, invested, pnl, pnlPct: invested > 0 ? (pnl / invested) * 100 : 0 }
}
