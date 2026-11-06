"use client"

import { useCallback, useEffect, useState } from "react"
import { convertToEur } from "@/lib/currency"
import { getSetting, setSetting } from "@/lib/settings"
import type { Account, Transaction } from "@/lib/store"

// Historial de ventas. Se guarda como ajuste en la nube (tabla `settings`, ya
// existente): no hace falta tocar la base de datos.
export const SALES_KEY = "investment-sales"

export interface SaleRecord {
  id: string
  positionId: string
  name: string
  code?: string | null
  date: string // YYYY-MM-DD
  units: number
  received: number // EUR (neto tras comisión)
  gain: number // EUR (negativo = pérdida)
  commission?: number // EUR, si hubo
  txId?: string // movimiento de ganancia/pérdida, si se apuntó
}

export interface SaleView {
  id: string
  name: string
  code?: string | null
  date: string
  units: number | null
  received: number | null
  gain: number
  commission: number | null
  legacy: boolean // reconstruida a partir de un movimiento «Venta …» antiguo
}

export function parseSales(raw: string | null | undefined): SaleRecord[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((s) => s && typeof s.id === "string" && typeof s.date === "string" && Number.isFinite(s.gain)) : []
  } catch { return [] }
}


/**
 * Posiciones abiertas que ya están totalmente cubiertas por ventas registradas
 * (mismo positionId, uds vendidas ≥ uds actuales). Típico zombie tras una venta
 * total cuyo delete no llegó a la nube.
 */
export function fullySoldPositionIds(
  positions: { id: string; units: number }[],
  sales: Pick<SaleRecord, "positionId" | "units">[],
): string[] {
  const soldByPos = new Map<string, number>()
  for (const s of sales) {
    if (!s.positionId || !Number.isFinite(s.units) || s.units <= 0) continue
    soldByPos.set(s.positionId, (soldByPos.get(s.positionId) ?? 0) + s.units)
  }
  const out: string[] = []
  for (const p of positions) {
    if (!(p.units > 0)) { out.push(p.id); continue }
    const sold = soldByPos.get(p.id) ?? 0
    if (sold > 0 && sold >= p.units - 1e-6) out.push(p.id)
  }
  return out
}

function mergeById(a: SaleRecord[], b: SaleRecord[]): SaleRecord[] {
  const m = new Map<string, SaleRecord>()
  for (const s of [...a, ...b]) m.set(s.id, s)
  return [...m.values()]
}

/** Ventas guardadas + ventas antiguas deducidas de movimientos «Venta …» (solo ganancia/pérdida). */
export function salesHistory(sales: SaleRecord[], transactions: Transaction[], accounts: Account[], year: string) {
  const linked = new Set(sales.map((s) => s.txId).filter(Boolean))
  const rows: SaleView[] = sales.map((s) => ({ id: s.id, name: s.name, code: s.code, date: s.date, units: s.units, received: s.received, gain: s.gain, commission: s.commission ?? null, legacy: false }))
  for (const t of transactions) {
    if (linked.has(t.id) || !t.descripcion?.startsWith("Venta ") || !(t.tags ?? []).includes("inversion")) continue
    const cur = accounts.find((a) => a.id === t.cuenta_id)?.currency ?? "EUR"
    const eur = convertToEur(Math.abs(t.monto), cur)
    rows.push({ id: `tx:${t.id}`, name: t.descripcion.slice(6), date: t.fecha, units: null, received: null, gain: t.tipo === "ingreso" ? eur : -eur, commission: null, legacy: true })
  }
  rows.sort((a, b) => b.date.localeCompare(a.date))
  const realizedYear = rows.filter((r) => r.date.startsWith(year)).reduce((s, r) => s + r.gain, 0)
  return { rows, realizedYear }
}

export function useInvestmentSales() {
  const [sales, setSales] = useState<SaleRecord[]>([])

  const refreshSales = useCallback(async (opts?: { pushLocalExtras?: boolean }) => {
    let local: SaleRecord[] = []
    try { local = parseSales(localStorage.getItem(SALES_KEY)) } catch {}
    if (local.length) setSales(local)
    try {
      const remote = await getSetting(SALES_KEY)
      if (remote === undefined) return // sin red / error: no pisar
      const remoteParsed = parseSales(remote)
      const merged = mergeById(remoteParsed, local)
      setSales(merged)
      try { localStorage.setItem(SALES_KEY, JSON.stringify(merged)) } catch {}
      // Solo en la carga inicial empujamos ventas locales que la nube aún no tiene.
      if (opts?.pushLocalExtras && merged.length > remoteParsed.length) {
        void setSetting(SALES_KEY, JSON.stringify(merged))
      }
    } catch { /* offline */ }
  }, [])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) void refreshSales({ pushLocalExtras: true }) })
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return
      void refreshSales({ pushLocalExtras: false })
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVisibility) }
  }, [refreshSales])

  const addSale = useCallback((s: SaleRecord) => {
    setSales((prev) => {
      const next = mergeById(prev, [s])
      const raw = JSON.stringify(next)
      try { localStorage.setItem(SALES_KEY, raw) } catch {}
      // Se relee la nube antes de escribir para no pisar ventas de otro dispositivo.
      void getSetting(SALES_KEY).then((remote) => setSetting(SALES_KEY, JSON.stringify(mergeById(parseSales(remote), next)))).catch(() => {})
      return next
    })
  }, [])

  return { sales, addSale, refreshSales }
}
