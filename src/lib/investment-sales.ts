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
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      let local: SaleRecord[] = []
      try { local = parseSales(localStorage.getItem(SALES_KEY)) } catch {}
      if (!cancelled && local.length) setSales(local)
      void getSetting(SALES_KEY).then((remote) => {
        if (cancelled) return
        const merged = mergeById(parseSales(remote), local)
        setSales(merged)
        try { localStorage.setItem(SALES_KEY, JSON.stringify(merged)) } catch {}
        if (merged.length > parseSales(remote).length) void setSetting(SALES_KEY, JSON.stringify(merged))
      }).catch(() => {})
    })
    return () => { cancelled = true }
  }, [])

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

  return { sales, addSale }
}
