"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"
import { getUpcomingRecurring, type UpcomingRecurring } from "./calculations"
import { useFinance, type Transaction } from "./store"
import { dbDeleteIn, dbSelect, dbUpsert } from "./db-client"
import { localDateKey } from "./date-utils"
import { applyDebtPayments, debtRecurring, parseAssets, parseAssetValues, parseDebts, type Asset, type AssetValue, type Debt } from "./assets-debts"

// Almacén compartido (Inicio + Patrimonio) para las tablas assets, asset_values y debts.
type Snapshot = { assets: Asset[]; values: AssetValue[]; debts: Debt[]; loaded: boolean }
let snapshot: Snapshot = { assets: [], values: [], debts: [], loaded: false }
let inflight: Promise<void> | null = null
const listeners = new Set<() => void>()
const emit = (next: Snapshot) => { snapshot = next; listeners.forEach((l) => l()) }

// El valor actual de un bien es el último de su historial (si lo tiene).
function withLatest(assets: Asset[], values: AssetValue[]): Asset[] {
  return parseAssets(assets.map((a) => {
    const own = values.filter((v) => v.asset_id === a.id)
    const last = own[own.length - 1]
    return last ? { ...a, valor: last.valor, valor_fecha: last.fecha } : a
  }))
}

function load() {
  if (inflight || snapshot.loaded) return
  inflight = Promise.all([
    dbSelect<Record<string, unknown>>("assets"),
    dbSelect<Record<string, unknown>>("debts"),
    dbSelect<Record<string, unknown>>("asset_values").catch(() => null),
  ])
    .then(([a, d, v]) => {
      const values = parseAssetValues(v ?? [])
      emit({ assets: withLatest(parseAssets(a ?? []), values), values, debts: parseDebts(d ?? []), loaded: true })
    })
    .finally(() => { inflight = null })
}
function subscribe(l: () => void) { listeners.add(l); load(); return () => { listeners.delete(l) } }
const SERVER: Snapshot = { assets: [], values: [], debts: [], loaded: false }
const now = () => new Date().toISOString()
const newValueId = () => `av_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function useAssetsDebts() {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => SERVER)
  const { state } = useFinance()
  const debts = useMemo(() => applyDebtPayments(snap.debts, state.transactions), [snap.debts, state.transactions])

  const addAssetValue = useCallback(async (assetId: string, valor: number, fecha: string) => {
    const v: AssetValue = { id: newValueId(), asset_id: assetId, valor, fecha }
    await dbUpsert("asset_values", [v])
    const values = parseAssetValues([...snapshot.values, v])
    const assets = withLatest(snapshot.assets, values)
    const a = assets.find((x) => x.id === assetId)
    if (a) await dbUpsert("assets", [{ ...a, updated_at: now() }])
    emit({ ...snapshot, values, assets })
  }, [])
  const deleteAssetValue = useCallback(async (id: string) => {
    const v = snapshot.values.find((x) => x.id === id)
    if (!v || snapshot.values.filter((x) => x.asset_id === v.asset_id).length <= 1) return // siempre queda uno
    await dbDeleteIn("asset_values", [id])
    const values = snapshot.values.filter((x) => x.id !== id)
    const assets = withLatest(snapshot.assets, values)
    const a = assets.find((x) => x.id === v.asset_id)
    if (a) await dbUpsert("assets", [{ ...a, updated_at: now() }])
    emit({ ...snapshot, values, assets })
  }, [])
  // Guardar un bien: si es nuevo o cambia su valor, queda en el historial.
  const saveAsset = useCallback(async (a: Asset) => {
    const prev = snapshot.assets.find((x) => x.id === a.id)
    await dbUpsert("assets", [{ ...a, updated_at: now() }])
    let values = snapshot.values
    if (!prev || prev.valor !== a.valor || !values.some((v) => v.asset_id === a.id)) {
      const v: AssetValue = { id: newValueId(), asset_id: a.id, valor: a.valor, fecha: a.valor_fecha ?? localDateKey(new Date()) }
      await dbUpsert("asset_values", [v])
      values = parseAssetValues([...values, v])
    }
    emit({ ...snapshot, values, assets: withLatest([...snapshot.assets.filter((x) => x.id !== a.id), a], values) })
  }, [])
  const deleteAsset = useCallback(async (id: string) => {
    await dbDeleteIn("assets", [id])
    const ownValues = snapshot.values.filter((v) => v.asset_id === id).map((v) => v.id)
    if (ownValues.length) await dbDeleteIn("asset_values", ownValues)
    const linked = snapshot.debts.filter((d) => d.asset_id === id).map((d) => ({ ...d, asset_id: null }))
    if (linked.length) await dbUpsert("debts", linked)
    emit({ ...snapshot, values: snapshot.values.filter((v) => v.asset_id !== id), assets: snapshot.assets.filter((x) => x.id !== id), debts: parseDebts(snapshot.debts.map((d) => (d.asset_id === id ? { ...d, asset_id: null } : d))) })
  }, [])
  // El formulario guarda el pendiente real (ya con las cuotas pagadas), así
  // que pendiente_at pasa a ahora y solo cuentan las cuotas posteriores.
  const saveDebt = useCallback(async (input: Debt) => {
    const d = { ...input, pendiente_at: now() }
    await dbUpsert("debts", [{ ...d, updated_at: d.pendiente_at }])
    emit({ ...snapshot, debts: parseDebts([...snapshot.debts.filter((x) => x.id !== d.id), d]) })
  }, [])
  const deleteDebt = useCallback(async (id: string) => {
    await dbDeleteIn("debts", [id])
    emit({ ...snapshot, debts: snapshot.debts.filter((x) => x.id !== id) })
  }, [])
  return { ...snap, debts, saveAsset, deleteAsset, saveDebt, deleteDebt, addAssetValue, deleteAssetValue }
}

/** Gastos fijos de siempre + las cuotas de deudas marcadas como gasto fijo. */
export function useRecurringWithDebts(transactions: Transaction[]): UpcomingRecurring[] {
  const snap = useSyncExternalStore(subscribe, () => snapshot, () => SERVER)
  return useMemo(() => [...getUpcomingRecurring(transactions), ...debtRecurring(snap.debts, transactions)], [transactions, snap.debts])
}
