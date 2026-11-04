"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { getUpcomingRecurring, type UpcomingRecurring } from "./calculations"
import type { Transaction } from "./store"
import { dbDeleteIn, dbSelect, dbUpsert } from "./db-client"
import { debtRecurring, parseAssets, parseDebts, type Asset, type Debt } from "./assets-debts"

// Almacén compartido (Inicio + Patrimonio) para las tablas assets y debts.
type Snapshot = { assets: Asset[]; debts: Debt[]; loaded: boolean }
let snapshot: Snapshot = { assets: [], debts: [], loaded: false }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = (next: Snapshot) => { snapshot = next; listeners.forEach((l) => l()) }

function load() {
  if (inflight || snapshot.loaded) return
  inflight = Promise.all([dbSelect<Record<string, unknown>>("assets"), dbSelect<Record<string, unknown>>("debts")])
    .then(([a, d]) => emit({ assets: parseAssets(a ?? []), debts: parseDebts(d ?? []), loaded: true }))
    .finally(() => { inflight = null })
}
function subscribe(l: () => void) { listeners.add(l); load(); return () => { listeners.delete(l) } }
const SERVER: Snapshot = { assets: [], debts: [], loaded: false }
const now = () => new Date().toISOString()

export function useAssetsDebts() {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => SERVER)
  const saveAsset = useCallback(async (a: Asset) => {
    await dbUpsert("assets", [{ ...a, updated_at: now() }])
    emit({ ...snapshot, assets: parseAssets([...snapshot.assets.filter((x) => x.id !== a.id), a]) })
  }, [])
  const deleteAsset = useCallback(async (id: string) => {
    await dbDeleteIn("assets", [id])
    const linked = snapshot.debts.filter((d) => d.asset_id === id).map((d) => ({ ...d, asset_id: null }))
    if (linked.length) await dbUpsert("debts", linked)
    emit({ ...snapshot, assets: snapshot.assets.filter((x) => x.id !== id), debts: parseDebts(snapshot.debts.map((d) => (d.asset_id === id ? { ...d, asset_id: null } : d))) })
  }, [])
  const saveDebt = useCallback(async (d: Debt) => {
    await dbUpsert("debts", [{ ...d, updated_at: now() }])
    emit({ ...snapshot, debts: parseDebts([...snapshot.debts.filter((x) => x.id !== d.id), d]) })
  }, [])
  const deleteDebt = useCallback(async (id: string) => {
    await dbDeleteIn("debts", [id])
    emit({ ...snapshot, debts: snapshot.debts.filter((x) => x.id !== id) })
  }, [])
  return { ...snap, saveAsset, deleteAsset, saveDebt, deleteDebt }
}

/** Gastos fijos de siempre + las cuotas de deudas marcadas como gasto fijo. */
export function useRecurringWithDebts(transactions: Transaction[]): UpcomingRecurring[] {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => SERVER)
  return useMemo(() => [...getUpcomingRecurring(transactions), ...debtRecurring(snap.debts, transactions)], [transactions, snap.debts])
}
