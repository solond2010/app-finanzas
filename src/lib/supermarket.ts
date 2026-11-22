// Tienda en gastos de supermercado. El campo es opcional y solo aplica
// a categorías de súper (la predeterminada y otras con el mismo sentido).

import { categoryKey } from "./category-names"
import { countsTowardCashFlow, filterTransactionsByMonth, reportingAmount, type CurrencyByAccount } from "./calculations"
import type { Transaction } from "./store"

export const SUPERMARKET_STORES = ["Mercadona", "Lidl", "Carrefour", "Dia", "Alcampo", "Aldi"] as const
export const SUPERMARKET_OTHER_STORE = "Otro"
export const SUPERMARKET_UNKNOWN_STORE = "Sin tienda"
export const MAX_STORE_NAME = 40

const DEFAULT_KEYS = new Set(SUPERMARKET_STORES.map((name) => categoryKey(name)))

function byRecency<T extends { fecha: string; created_at?: string }>(a: T, b: T) {
  const byDate = b.fecha.localeCompare(a.fecha)
  if (byDate) return byDate
  return (b.created_at ?? "").localeCompare(a.created_at ?? "")
}

export function isSupermarketCategory(name: string | null | undefined): boolean {
  const key = categoryKey(name ?? "")
  if (!key) return false
  if (key === "super" || key === "supermercado" || key === "hipermercado") return true
  return key.includes("supermercado") || key.includes("hipermercado")
}

export function normalizeStoreName(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_STORE_NAME)
}

export function transactionStore(transaction: Pick<Transaction, "tienda">): string {
  return normalizeStoreName(transaction.tienda)
}

export function sameStoreName(a: string, b: string): boolean {
  return Boolean(a && b && categoryKey(a) === categoryKey(b))
}

/** En la lista, no repetir la tienda si ya es el título del movimiento. */
export function storeLabelForList(transaction: Pick<Transaction, "tienda" | "descripcion" | "categoria">): string {
  const store = transactionStore(transaction)
  if (!store) return ""
  const title = (transaction.descripcion || transaction.categoria || "").trim()
  if (title && sameStoreName(title, store)) return ""
  return store
}

/** Tiendas escritas antes que no están en los chips fijos, las más recientes primero. */
export function rememberedStores(transactions: Array<Pick<Transaction, "tipo" | "categoria" | "tienda" | "fecha" | "created_at">>): string[] {
  const seen = new Set<string>()
  const names: string[] = []
  for (const item of [...transactions].sort(byRecency)) {
    if (item.tipo !== "gasto" || !isSupermarketCategory(item.categoria)) continue
    const name = normalizeStoreName(item.tienda)
    if (!name) continue
    const key = categoryKey(name)
    if (DEFAULT_KEYS.has(key) || seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names.slice(0, 8)
}

/** Última tienda usada en un gasto de súper, para prellenar el alta. */
export function lastUsedStore(transactions: Array<Pick<Transaction, "tipo" | "categoria" | "tienda" | "fecha" | "created_at">>): string {
  for (const item of [...transactions].sort(byRecency)) {
    if (item.tipo !== "gasto" || !isSupermarketCategory(item.categoria)) continue
    const name = normalizeStoreName(item.tienda)
    if (name) return name
  }
  return ""
}

/** Qué viaja en el upsert: si el cliente viejo no tenía el campo, no se envía. */
export function tiendaPayload(tienda: string | undefined): { tienda: string } | Record<string, never> {
  return tienda === undefined ? {} : { tienda }
}

export type StoreBreakdownRow = { tienda: string; monto: number; porcentaje: number }

export function supermarketStoreBreakdown(
  transactions: Transaction[],
  monthKey: string,
  currencies?: CurrencyByAccount,
): StoreBreakdownRow[] {
  const rows = filterTransactionsByMonth(transactions, monthKey).filter((item) =>
    item.tipo === "gasto"
    && isSupermarketCategory(item.categoria)
    && countsTowardCashFlow(item, transactions),
  )
  const totals = new Map<string, { label: string; monto: number }>()
  for (const item of rows) {
    const name = transactionStore(item)
    const key = name ? categoryKey(name) : ""
    const label = name || SUPERMARKET_UNKNOWN_STORE
    const current = totals.get(key) ?? { label, monto: 0 }
    current.monto += reportingAmount(item, currencies)
    totals.set(key, current)
  }
  const list = [...totals.values()].sort((a, b) => {
    if (b.monto !== a.monto) return b.monto - a.monto
    if (a.label === SUPERMARKET_UNKNOWN_STORE) return 1
    if (b.label === SUPERMARKET_UNKNOWN_STORE) return -1
    return a.label.localeCompare(b.label, "es")
  })
  const total = list.reduce((sum, row) => sum + row.monto, 0)
  return list.map((row) => ({
    tienda: row.label,
    monto: row.monto,
    porcentaje: total > 0 ? Math.round((row.monto / total) * 100) : 0,
  }))
}

export function supermarketStoreTotal(rows: StoreBreakdownRow[]): number {
  return rows.reduce((sum, row) => sum + row.monto, 0)
}

export function resolvedStoreForCategory(categoria: string, tipo: string, tienda: string): string {
  if (tipo !== "gasto" || !isSupermarketCategory(categoria)) return ""
  return normalizeStoreName(tienda)
}
