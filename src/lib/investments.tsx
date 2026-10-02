"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { addMonths, addWeeks, format, parseISO } from "date-fns"
import { dbSelect, dbUpsert, dbDeleteEq } from "./db-client"
import { USER_ID, useFinance, type Account } from "./store"

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

type InvestmentTable = "investments" | "watchlist" | "investment_contributions"
type InvestmentSyncStatus = "idle" | "syncing" | "saved" | "error" | "offline"
interface PendingInvestmentWrite {
  id: string
  table: InvestmentTable
  keyField: "id" | "symbol"
  key: string
  operation: "upsert" | "delete"
  row?: Record<string, unknown>
}

const OUTBOX_KEY = "app-finanzas-investment-outbox"

function readInvestmentOutbox(): PendingInvestmentWrite[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is PendingInvestmentWrite =>
      item && typeof item.id === "string" &&
      ["investments", "watchlist", "investment_contributions"].includes(item.table) &&
      ["upsert", "delete"].includes(item.operation) &&
      typeof item.key === "string" && typeof item.keyField === "string"
    )
  } catch {
    return []
  }
}

function overlayPendingRows<T>(rows: T[], table: InvestmentTable, keyField: "id" | "symbol", pending: PendingInvestmentWrite[], parse: (row: Record<string, unknown>) => T): T[] {
  const byKey = new Map(rows.map((row) => [String((row as Record<string, unknown>)[keyField]), row]))
  for (const item of pending) {
    if (item.table !== table) continue
    if (item.operation === "delete") byKey.delete(item.key)
    else if (item.row) byKey.set(item.key, parse(item.row))
  }
  return [...byKey.values()]
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

// Racha de constancia aportando: periodos consecutivos (meses o semanas,
// según la cadencia del plan) con al menos un aporte registrado, contando
// hacia atrás desde el periodo actual (o el anterior, si el actual todavía no
// tiene aporte). Mismo principio que la racha de ahorro del Dashboard.
export function dcaStreak(contributions: Contribution[], positionId: string, freq: DcaFreq, today: Date = new Date()): number {
  const bucketKey = (d: Date) => format(d, freq === "weekly" ? "RRRR-II" : "yyyy-MM")
  const buckets = new Set(contributions.filter((c) => c.positionId === positionId).map((c) => bucketKey(parseISO(c.date))))
  if (buckets.size === 0) return 0

  let cursor = today
  if (!buckets.has(bucketKey(cursor))) cursor = freq === "weekly" ? addWeeks(cursor, -1) : addMonths(cursor, -1)

  let count = 0
  while (buckets.has(bucketKey(cursor))) {
    count++
    cursor = freq === "weekly" ? addWeeks(cursor, -1) : addMonths(cursor, -1)
  }
  return count
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
  add: (p: Omit<Position, "id">) => { id: string; merged: boolean; saved: boolean }
  update: (p: Position) => boolean
  remove: (id: string) => boolean
  watchlist: WatchItem[]
  addWatch: (w: WatchItem) => void
  removeWatch: (symbol: string) => void
  applyDca: (positionId: string, price: number) => number
  contributions: Contribution[]
  addContribution: (positionId: string, amount: number, date: string) => boolean
  syncStatus: InvestmentSyncStatus
  retrySync: () => void
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
  const [syncStatus, setSyncStatus] = useState<InvestmentSyncStatus>("idle")
  const pendingRef = useRef<PendingInvestmentWrite[]>([])
  const flushingRef = useRef(false)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryCountRef = useRef(0)

  const saveOutbox = useCallback(() => {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(pendingRef.current))
      return true
    } catch {
      setSyncStatus("error")
      return false
    }
  }, [])

  const flushOutboxRef = useRef<() => Promise<void>>(async () => {})
  const flushOutbox = useCallback(async () => {
    if (flushingRef.current) return
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (pendingRef.current.length) setSyncStatus("offline")
      return
    }
    flushingRef.current = true
    if (pendingRef.current.length) setSyncStatus("syncing")
    try {
      while (pendingRef.current.length > 0) {
        const write = pendingRef.current[0]
        if (write.operation === "upsert" && write.row) await dbUpsert(write.table, [write.row])
        else await dbDeleteEq(write.table, write.keyField, write.key)
        const current = pendingRef.current.findIndex((item) => item.id === write.id)
        if (current >= 0) {
          pendingRef.current = pendingRef.current.filter((item) => item.id !== write.id)
          saveOutbox()
        }
      }
      retryCountRef.current = 0
      setSyncStatus("saved")
    } catch (error) {
      console.error("[Finance] Error al sincronizar inversiones:", error)
      setSyncStatus(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "error")
      if (retryRef.current) clearTimeout(retryRef.current)
      const delay = Math.min(3000 * 2 ** retryCountRef.current, 30_000)
      retryCountRef.current++
      retryRef.current = setTimeout(() => { void flushOutboxRef.current() }, delay)
    } finally {
      flushingRef.current = false
    }
  }, [saveOutbox])
  useEffect(() => { flushOutboxRef.current = flushOutbox }, [flushOutbox])

  const enqueue = useCallback((write: Omit<PendingInvestmentWrite, "id">) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const previous = pendingRef.current
    pendingRef.current = previous.filter((item) => !(item.table === write.table && item.keyField === write.keyField && item.key === write.key))
    pendingRef.current.push({ ...write, id })
    if (!saveOutbox()) {
      pendingRef.current = previous
      return false
    }
    void flushOutbox()
    return true
  }, [flushOutbox, saveOutbox])

  const retrySync = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current)
    retryRef.current = null
    retryCountRef.current = 0
    void flushOutbox()
  }, [flushOutbox])

  useEffect(() => {
    pendingRef.current = readInvestmentOutbox()
    if (pendingRef.current.length) void flushOutbox()
    const onOnline = () => retrySync()
    const onOffline = () => { if (pendingRef.current.length) setSyncStatus("offline") }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [flushOutbox, retrySync])

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
          let remote = data.map((w) => ({ symbol: w.symbol, name: w.name }))
          if (data.length === 0 && localWatch.length > 0 && !pendingRef.current.some((item) => item.table === "watchlist")) {
            remote = localWatch
            localWatch.forEach((w) => enqueue({ table: "watchlist", keyField: "symbol", key: w.symbol, operation: "upsert", row: { ...w, user_id: USER_ID } }))
          }
          remote = overlayPendingRows(remote, "watchlist", "symbol", pendingRef.current, (row) => ({ symbol: String(row.symbol), name: String(row.name) }))
          setWatchlist(remote)
          try { localStorage.setItem(WATCH_KEY, JSON.stringify(remote)) } catch {}
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
        if (data.length === 0 && local.length > 0 && !pendingRef.current.some((item) => item.table === "investments")) {
          // La tabla existe pero está vacía: migra lo que había en localStorage.
          local.forEach((position) => enqueue({ table: "investments", keyField: "id", key: position.id, operation: "upsert", row: toRow(position) }))
        }
        const remote = overlayPendingRows(data.map(fromRow), "investments", "id", pendingRef.current, (row) => fromRow(row as unknown as InvestmentRow))
        loadedPositions = remote
        setPositions(remote)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)) } catch {}
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
        if (data.length === 0 && localContrib.length > 0 && !pendingRef.current.some((item) => item.table === "investment_contributions")) {
          remote = localContrib
          localContrib.forEach((contribution) => enqueue({ table: "investment_contributions", keyField: "id", key: contribution.id, operation: "upsert", row: contributionToRow(contribution) }))
        }
        remote = overlayPendingRows(remote, "investment_contributions", "id", pendingRef.current, (row) => contributionFromRow(row as unknown as ContributionRow))
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
          missing.forEach((contribution) => enqueue({ table: "investment_contributions", keyField: "id", key: contribution.id, operation: "upsert", row: contributionToRow(contribution) }))
          remote = [...remote, ...missing]
        }
        setContributions(remote)
        try { localStorage.setItem(CONTRIB_KEY, JSON.stringify(remote)) } catch {}
      } catch {
        // Sin tabla / sin red → seguimos solo con localStorage.
      }
    })
  }, [enqueue])

  const persistLocal = (next: Position[]) => {
    setPositions(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { setSyncStatus("error") }
  }

  const add = (p: Omit<Position, "id">) => {
    // Comprar más de un activo que ya tienes en la misma cuenta no debe crear
    // una posición duplicada: se fusiona en la existente recalculando el
    // precio medio ponderado (mismo cálculo que applyDca para los aportes DCA).
    const existing = positions.find((x) => x.symbol === p.symbol && x.accountId === p.accountId)
    if (existing) {
      const merged = mergedPosition(existing, p)
      if (!update(merged)) return { id: existing.id, merged: true, saved: false }
      const addedCost = p.units * p.buyPrice
      if (addedCost > 0) addContribution(existing.id, addedCost, p.date)
      return { id: existing.id, merged: true, saved: true }
    }
    // eslint-disable-next-line react-hooks/purity -- event-handler code, not render; needs a fresh id per call
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const pos: Position = { ...p, id }
    if (!enqueue({ table: "investments", keyField: "id", key: id, operation: "upsert", row: toRow(pos) })) return { id, merged: false, saved: false }
    persistLocal([...positions, pos])
    if (pos.units * pos.buyPrice > 0) addContribution(id, pos.units * pos.buyPrice, pos.date)
    return { id, merged: false, saved: true }
  }

  const update = (pos: Position) => {
    if (!enqueue({ table: "investments", keyField: "id", key: pos.id, operation: "upsert", row: toRow(pos) })) return false
    persistLocal(positions.map((x) => (x.id === pos.id ? pos : x)))
    return true
  }

  const remove = (id: string) => {
    if (!enqueue({ table: "investments", keyField: "id", key: id, operation: "delete" })) return false
    persistLocal(positions.filter((x) => x.id !== id))
    return true
  }

  const persistWatch = (next: WatchItem[]) => {
    setWatchlist(next)
    try { localStorage.setItem(WATCH_KEY, JSON.stringify(next)) } catch { setSyncStatus("error") }
  }
  const addWatch = (w: WatchItem) => {
    if (watchlist.some((x) => x.symbol === w.symbol)) return
    if (!enqueue({ table: "watchlist", keyField: "symbol", key: w.symbol, operation: "upsert", row: { symbol: w.symbol, name: w.name, user_id: USER_ID } })) return
    persistWatch([...watchlist, w])
  }
  const removeWatch = (symbol: string) => {
    if (!enqueue({ table: "watchlist", keyField: "symbol", key: symbol, operation: "delete" })) return
    persistWatch(watchlist.filter((x) => x.symbol !== symbol))
  }

  const persistContrib = (next: Contribution[]) => {
    setContributions(next)
    try { localStorage.setItem(CONTRIB_KEY, JSON.stringify(next)) } catch { setSyncStatus("error") }
  }
  const addContribution = (positionId: string, amount: number, date: string) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const c: Contribution = { id, positionId, amount, date }
    if (!enqueue({ table: "investment_contributions", keyField: "id", key: c.id, operation: "upsert", row: contributionToRow(c) })) return false
    persistContrib([...contributions, c])
    return true
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
    if (!update({ ...pos, units: newUnits, buyPrice: newBuyPrice, dcaLast: lastDate })) return 0
    for (const d of due) addContribution(positionId, plan.amount, format(d, "yyyy-MM-dd"))
    return due.length
  }

  return <InvestmentsContext.Provider value={{ positions, add, update, remove, watchlist, addWatch, removeWatch, applyDca, contributions, addContribution, syncStatus, retrySync }}>{children}</InvestmentsContext.Provider>
}

export function useInvestments() {
  const ctx = useContext(InvestmentsContext)
  if (!ctx) throw new Error("useInvestments must be used within InvestmentsProvider")
  return ctx
}

export function useInvestmentSyncStatus() {
  const { syncStatus, retrySync } = useInvestments()
  return { status: syncStatus, retrySync }
}

interface Quote { price: number; currency: string; changePct?: number | null; name?: string }

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

  // Memoizados para que su referencia sea estable entre renders: varios
  // useMemo/useEffect de las páginas (y useDisplayAccounts) dependen de estos
  // objetos; sin memo se recreaban en cada render y esas dependencias no
  // servían de nada.
  const valueByAccount = useMemo(() => positions.reduce<Record<string, number>>((m, p) => {
    if (p.accountId) m[p.accountId] = (m[p.accountId] ?? 0) + p.units * (p.kind === "custom" ? p.buyPrice : quotes[p.symbol]?.price ?? p.buyPrice)
    return m
  }, {}), [positions, quotes])
  // Coste de compra de las posiciones de cada cuenta: junto con el saldo bruto,
  // permite separar "efectivo aún sin invertir" del valor ya invertido (ver
  // accountDisplayValue). Comprar una posición no descuenta su coste del saldo
  // de la cuenta (no genera un gasto), así que sin esto el saldo bruto no dice
  // nada por sí solo una vez hay posiciones de por medio.
  const investedByAccount = useMemo(() => positions.reduce<Record<string, number>>((m, p) => {
    if (p.accountId) m[p.accountId] = (m[p.accountId] ?? 0) + p.units * p.buyPrice
    return m
  }, {}), [positions])

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

/**
 * Cuentas del store con su `saldo` ya sustituido por el valor real de
 * accountDisplayValue. Cualquier widget que muestre o sume saldos debe usar
 * esto (no state.accounts directamente): si no, las cuentas de inversión
 * enseñan el saldo contable en unas páginas y el valor de mercado en otras,
 * y la misma cuenta aparece con cifras distintas según dónde se mire.
 */
export function useDisplayAccounts(): Account[] {
  const { state } = useFinance()
  const { valueByAccount, investedByAccount } = usePortfolioValue()
  return useMemo(
    () => state.accounts.map((a) => (a.tipo === "inversion" ? { ...a, saldo: accountDisplayValue(a, valueByAccount, investedByAccount) } : a)),
    [state.accounts, valueByAccount, investedByAccount]
  )
}
