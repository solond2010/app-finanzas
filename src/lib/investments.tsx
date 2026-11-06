"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { addMonths, addWeeks, format, parseISO } from "date-fns"
import { dbSelect, dbUpsert, dbDeleteEq } from "./db-client"

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
export interface PendingInvestmentWrite {
  id: string
  table: InvestmentTable
  keyField: "id" | "symbol"
  key: string
  operation: "upsert" | "delete"
  row?: Record<string, unknown>
}

/**
 * Un aporte necesita que su posición exista antes en la nube. Si la subida de
 * la posición quedó detrás de su aporte en la cola (p. ej. porque se editó
 * justo después de crearla), se adelanta. Sin esto la cola se atasca para
 * siempre con «Error al guardar».
 */
export function orderParentsFirst(queue: PendingInvestmentWrite[]): PendingInvestmentWrite[] {
  const out = [...queue]
  for (let i = 0; i < out.length; i++) {
    const w = out[i]
    if (w.table !== "investment_contributions" || w.operation !== "upsert") continue
    const parent = w.row?.position_id
    const j = out.findIndex((x, k) => k > i && x.table === "investments" && x.operation === "upsert" && x.key === parent)
    if (j > i) { const [pw] = out.splice(j, 1); out.splice(i, 0, pw); i++ }
  }
  return out
}

/** Escritura en cola que sustituye a otra de la misma fila conservando su sitio (no la manda al final). */
export function replaceInQueue(queue: PendingInvestmentWrite[], write: PendingInvestmentWrite): PendingInvestmentWrite[] {
  const i = queue.findIndex((item) => item.table === write.table && item.keyField === write.keyField && item.key === write.key)
  if (i < 0) return [...queue, write]
  const next = [...queue]
  next[i] = write
  return next
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
  return { id: c.id, position_id: c.positionId, amount: c.amount, date: c.date }
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

/**
 * Para un aporte mensual el día `day` (1–28): la última vez que tocó (hoy
 * incluido). Se guarda como `dcaLast`, así el primer aporte automático es el
 * siguiente y nunca se aplica nada hacia atrás.
 */
export function dcaAnchorForDay(day: number, today: Date = new Date()): string {
  const d = Math.min(28, Math.max(1, Math.round(day) || 1))
  const y = today.getFullYear(), m = today.getMonth()
  const anchor = today.getDate() >= d ? new Date(y, m, d) : new Date(y, m - 1, d)
  return format(anchor, "yyyy-MM-dd")
}

/** Id fijo por (posición, fecha programada): el mismo aporte en dos dispositivos es la misma fila. */
export function dcaContributionId(positionId: string, date: string): string {
  return `dca:${positionId}:${date}`
}

/** Quita aportes repetidos (mismo id, o mismo aporte automático de la misma fecha). */
export function dedupeContributions(list: Contribution[]): Contribution[] {
  const seen = new Set<string>()
  const out: Contribution[] = []
  for (const c of list) {
    const key = c.id.startsWith("dca:") ? c.id : `id:${c.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}

/** Entre la versión local y la de la nube, la que tiene el aporte automático más reciente ya aplicado. */
export function fresherDcaPosition(local: Position, remote: Position | undefined): Position {
  if (!remote) return local
  return (remote.dcaLast ?? remote.date) > (local.dcaLast ?? local.date) ? remote : local
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
/** Opciones al añadir: «ya la tenía» = posición de partida, no cuenta como
 * aportación (ni en el mes ni en el histórico); `thisMonth` sí cuenta. */
export interface AddOptions { preexisting?: boolean; thisMonth?: number; today?: string }

/** Aportaciones a apuntar al añadir una compra. Una posición de partida se
 * marca con un aporte de 0 € (así no se cuenta su compra como aportación). */
export function purchaseContributions(cost: number, date: string, opts: AddOptions = {}): { amount: number; date: string }[] {
  if (!opts.preexisting) return cost > 0 ? [{ amount: cost, date }] : []
  const out = [{ amount: 0, date }]
  if ((opts.thisMonth ?? 0) > 0) out.push({ amount: opts.thisMonth as number, date: opts.today ?? date })
  return out
}

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
  loaded: boolean
  add: (p: Omit<Position, "id">, opts?: AddOptions) => { id: string; merged: boolean; saved: boolean }
  update: (p: Position) => boolean
  remove: (id: string) => boolean
  watchlist: WatchItem[]
  addWatch: (w: WatchItem) => void
  removeWatch: (symbol: string) => void
  applyDca: (positionId: string, price: number) => Promise<number>
  contributions: Contribution[]
  addContribution: (positionId: string, amount: number, date: string) => boolean
  syncStatus: InvestmentSyncStatus
  retrySync: () => void
  /** Relée posiciones/aportes/watchlist desde el servidor (p. ej. al volver a la pestaña). */
  refresh: () => Promise<void>
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
  const positionsRef = useRef<Position[]>([])
  useEffect(() => { positionsRef.current = positions }, [positions])
  const [loaded, setLoaded] = useState(false)
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
    const resent = new Set<string>()
    try {
      while (pendingRef.current.length > 0) {
        pendingRef.current = orderParentsFirst(pendingRef.current)
        const write = pendingRef.current[0]
        try {
          if (write.operation === "upsert" && write.row) await dbUpsert(write.table, [write.row])
          else await dbDeleteEq(write.table, write.keyField, write.key)
        } catch (error) {
          const fk = error instanceof Error && /foreign key/i.test(error.message)
          if (!fk || write.table !== "investment_contributions") throw error
          const parentId = String(write.row?.position_id ?? "")
          const parent = positionsRef.current.find((p) => p.id === parentId)
          if (!parent) {
            // Aporte de una posición que ya no existe: se descarta (en la nube se
            // habría borrado igualmente con su posición).
            pendingRef.current = pendingRef.current.filter((item) => item.id !== write.id)
            saveOutbox()
            continue
          }
          // La posición existe aquí pero no en la nube: se sube primero (una vez).
          if (resent.has(parent.id)) throw error
          resent.add(parent.id)
          const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
          pendingRef.current = [{ id, table: "investments", keyField: "id", key: parent.id, operation: "upsert", row: toRow(parent) }, ...pendingRef.current.filter((item) => !(item.table === "investments" && item.key === parent.id))]
          saveOutbox()
          continue
        }
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
    pendingRef.current = replaceInQueue(previous, { ...write, id })
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

  const seededRef = useRef(false)
  const lastRefreshRef = useRef(0)
  const refreshingRef = useRef(false)

  const refreshFromServer = useCallback(async (opts?: { seed?: boolean }) => {
    const seed = opts?.seed === true && !seededRef.current
    if (refreshingRef.current) return
    refreshingRef.current = true
    try {
      // Watchlist
      let localWatch: WatchItem[] = []
      try {
        const wraw = localStorage.getItem(WATCH_KEY)
        if (wraw) localWatch = JSON.parse(wraw) as WatchItem[]
      } catch { /* ignore */ }
      try {
        const data = await dbSelect<{ symbol: string; name: string }>("watchlist")
        if (data) {
          let remote = data.map((w) => ({ symbol: w.symbol, name: w.name }))
          // Solo en la 1ª carga: migrar local → nube si la tabla está vacía.
          // En refetch, la nube manda (si otro dispositivo vació la lista, no la resucitamos).
          if (seed && data.length === 0 && localWatch.length > 0 && !pendingRef.current.some((item) => item.table === "watchlist")) {
            remote = localWatch
            localWatch.forEach((w) => enqueue({ table: "watchlist", keyField: "symbol", key: w.symbol, operation: "upsert", row: { symbol: w.symbol, name: w.name } }))
          }
          remote = overlayPendingRows(remote, "watchlist", "symbol", pendingRef.current, (row) => ({ symbol: String(row.symbol), name: String(row.name) }))
          setWatchlist(remote)
          try { localStorage.setItem(WATCH_KEY, JSON.stringify(remote)) } catch {}
        }
      } catch { /* offline → local */ }

      // Posiciones
      let local: Position[] = []
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) local = JSON.parse(raw) as Position[]
      } catch { /* ignore */ }
      let loadedPositions: Position[] = local
      try {
        const data = await dbSelect<InvestmentRow>("investments")
        if (data) {
          if (seed && data.length === 0 && local.length > 0 && !pendingRef.current.some((item) => item.table === "investments")) {
            local.forEach((position) => enqueue({ table: "investments", keyField: "id", key: position.id, operation: "upsert", row: toRow(position) }))
          }
          const remote = overlayPendingRows(data.map(fromRow), "investments", "id", pendingRef.current, (row) => fromRow(row as unknown as InvestmentRow))
          loadedPositions = remote
          setPositions(remote)
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(remote)) } catch {}
        }
      } catch { /* offline → local */ }

      // Aportes
      let localContrib: Contribution[] = []
      try {
        const craw = localStorage.getItem(CONTRIB_KEY)
        if (craw) localContrib = JSON.parse(craw) as Contribution[]
      } catch { /* ignore */ }
      try {
        const data = await dbSelect<ContributionRow>("investment_contributions")
        if (data) {
          let remote = data.map(contributionFromRow)
          if (seed && data.length === 0 && localContrib.length > 0 && !pendingRef.current.some((item) => item.table === "investment_contributions")) {
            remote = localContrib
            localContrib.forEach((contribution) => enqueue({ table: "investment_contributions", keyField: "id", key: contribution.id, operation: "upsert", row: contributionToRow(contribution) }))
          }
          remote = overlayPendingRows(remote, "investment_contributions", "id", pendingRef.current, (row) => contributionFromRow(row as unknown as ContributionRow))
          if (seed) {
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
          }
          remote = dedupeContributions(remote)
          setContributions(remote)
          try { localStorage.setItem(CONTRIB_KEY, JSON.stringify(remote)) } catch {}
        }
      } catch { /* offline → local */ }

      if (seed) seededRef.current = true
      lastRefreshRef.current = Date.now()
    } finally {
      refreshingRef.current = false
      setLoaded(true)
    }
  }, [enqueue])

  const refresh = useCallback(async () => {
    await refreshFromServer({ seed: false })
  }, [refreshFromServer])

  useEffect(() => {
    pendingRef.current = readInvestmentOutbox()
    if (pendingRef.current.length) void flushOutbox()
    // Pintar lo local al instante; luego la nube (con migración solo la 1ª vez).
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPositions(JSON.parse(raw) as Position[])
    } catch { /* ignore */ }
    try {
      const wraw = localStorage.getItem(WATCH_KEY)
      if (wraw) setWatchlist(JSON.parse(wraw) as WatchItem[])
    } catch { /* ignore */ }
    try {
      const craw = localStorage.getItem(CONTRIB_KEY)
      if (craw) setContributions(JSON.parse(craw) as Contribution[])
    } catch { /* ignore */ }
    void refreshFromServer({ seed: true })

    const onOnline = () => {
      retrySync()
      void refreshFromServer({ seed: false })
    }
    const onOffline = () => { if (pendingRef.current.length) setSyncStatus("offline") }
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastRefreshRef.current < 5000) return
      void refreshFromServer({ seed: false })
    }
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
      document.removeEventListener("visibilitychange", onVisibility)
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [flushOutbox, retrySync, refreshFromServer])

  const persistLocal = (next: Position[]) => {
    setPositions(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { setSyncStatus("error") }
  }

  const add = (p: Omit<Position, "id">, opts?: AddOptions) => {
    // Comprar más de un activo que ya tienes en la misma cuenta no debe crear
    // una posición duplicada: se fusiona en la existente recalculando el
    // precio medio ponderado (mismo cálculo que applyDca para los aportes DCA).
    const existing = positions.find((x) => x.symbol === p.symbol && x.accountId === p.accountId)
    if (existing) {
      const merged = mergedPosition(existing, p)
      if (!update(merged)) return { id: existing.id, merged: true, saved: false }
      for (const c of purchaseContributions(p.units * p.buyPrice, p.date, opts)) if (c.amount > 0) addContribution(existing.id, c.amount, c.date)
      return { id: existing.id, merged: true, saved: true }
    }
    // eslint-disable-next-line react-hooks/purity -- event-handler code, not render; needs a fresh id per call
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const pos: Position = { ...p, id }
    if (!enqueue({ table: "investments", keyField: "id", key: id, operation: "upsert", row: toRow(pos) })) return { id, merged: false, saved: false }
    persistLocal([...positions, pos])
    for (const c of purchaseContributions(pos.units * pos.buyPrice, pos.date, opts)) addContribution(id, c.amount, c.date)
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
    if (!enqueue({ table: "watchlist", keyField: "symbol", key: w.symbol, operation: "upsert", row: { symbol: w.symbol, name: w.name } })) return
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
  // Antes de aplicar se relee la nube: si otro dispositivo ya aplicó esos
  // meses se adopta su versión y no se suma nada. Los aportes usan un id fijo
  // por (posición, fecha), así que aunque coincidan dos dispositivos la nube
  // guarda una sola fila por mes.
  const applyDca = async (positionId: string, price: number): Promise<number> => {
    const local = positions.find((p) => p.id === positionId)
    if (!local || !price || price <= 0) return 0
    let pos = local
    let cloudIds = new Set<string>()
    try {
      const [rp, rc] = await Promise.all([dbSelect<InvestmentRow>("investments"), dbSelect<ContributionRow>("investment_contributions")])
      const remote = rp?.map(fromRow).find((p) => p.id === positionId)
      pos = fresherDcaPosition(local, remote)
      cloudIds = new Set((rc ?? []).filter((c) => c.position_id === positionId).map((c) => c.id))
      if (pos !== local) persistLocal(positions.map((x) => (x.id === pos.id ? pos : x)))
    } catch {
      // Sin red: se sigue con lo local (los ids fijos evitan duplicar en la nube).
    }
    const plan = planOf(pos)
    if (!plan) return 0
    const due = dcaPendingDates(plan).map((d) => format(d, "yyyy-MM-dd")).filter((d) => !cloudIds.has(dcaContributionId(positionId, d)))
    if (due.length === 0) return 0
    const totalAmount = due.length * plan.amount
    const unitsAdded = totalAmount / price
    const newUnits = pos.units + unitsAdded
    const newBuyPrice = newUnits > 0 ? (pos.units * pos.buyPrice + totalAmount) / newUnits : pos.buyPrice
    const updated = { ...pos, units: newUnits, buyPrice: newBuyPrice, dcaLast: due[due.length - 1] }
    if (!enqueue({ table: "investments", keyField: "id", key: pos.id, operation: "upsert", row: toRow(updated) })) return 0
    persistLocal(positions.map((x) => (x.id === pos.id ? updated : x)))
    const added: Contribution[] = due.map((date) => ({ id: dcaContributionId(positionId, date), positionId, amount: plan.amount, date }))
    added.forEach((c) => enqueue({ table: "investment_contributions", keyField: "id", key: c.id, operation: "upsert", row: contributionToRow(c) }))
    persistContrib(dedupeContributions([...contributions, ...added]))
    return due.length
  }

  return <InvestmentsContext.Provider value={{ positions, loaded, add, update, remove, watchlist, addWatch, removeWatch, applyDca, contributions, addContribution, syncStatus, retrySync, refresh }}>{children}</InvestmentsContext.Provider>
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
