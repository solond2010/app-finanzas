"use client"

import { createContext, useContext, useReducer, useEffect, useRef, useState, type ReactNode } from "react"
import { supabase } from "./supabase"
import { type CurrencyCode } from "./currency"

export interface Account {
  id: string
  nombre: string
  tipo: "emergencia" | "ahorro" | "inversion" | "efectivo" | "gastos"
  banco: string
  saldo: number
  currency: CurrencyCode
  objetivo: number | null
  limite_mensual: number | null
  color: string
}

export interface Transaction {
  id: string
  cuenta_id: string
  monto: number
  fecha: string
  tipo: "ingreso" | "gasto"
  categoria: string
  es_necesidad: boolean
  descripcion: string
  tags: string[]
}

export interface SinkingFund {
  id: string
  nombre: string
  cantidad_objetivo: number
  fecha_limite: string
  ahorrado_actual: number
  cuenta_id: string
}

export interface MonthlySummary {
  mes: string
  ingresos: number
  gastos: number
}

export interface NetWorthSnapshot {
  mes: string
  patrimonio: number
}

interface FinanceState {
  accounts: Account[]
  transactions: Transaction[]
  sinkingFunds: SinkingFund[]
  categories: string[]
}

type SyncStatus = "idle" | "syncing" | "saved" | "error"

type Action =
  | { type: "SET_STATE"; payload: FinanceState }
  | { type: "ADD_ACCOUNT"; payload: Account }
  | { type: "UPDATE_ACCOUNT"; payload: Account }
  | { type: "DELETE_ACCOUNT"; payload: string }
  | { type: "ADD_TRANSACTION"; payload: Transaction }
  | { type: "UPDATE_TRANSACTION"; payload: Transaction }
  | { type: "DELETE_TRANSACTION"; payload: string }
  | { type: "ADD_SINKING_FUND"; payload: SinkingFund }
  | { type: "UPDATE_SINKING_FUND"; payload: SinkingFund }
  | { type: "DELETE_SINKING_FUND"; payload: string }
  | { type: "MERGE_SAMPLE"; payload: FinanceState }
  | { type: "RESET" }
  | { type: "ADD_CATEGORY"; payload: string }
  | { type: "DELETE_CATEGORY"; payload: string }

const STORAGE_KEY = "app-finanzas-data"

const DEFAULT_CATEGORIES = ["Salario", "Freelance", "Alquiler", "Supermercado", "Transporte", "Internet", "Suscripciones", "Cena", "Ropa", "Ocio", "Gym", "Salud", "Inversión", "Transferencia", "Otros"]

const defaultState: FinanceState = {
  accounts: [
    { id: "acc_emergency", nombre: "Emergencias", tipo: "emergencia", banco: "", saldo: 0, currency: "EUR", objetivo: null, limite_mensual: null, color: "#10b981" },
    { id: "acc_ahorro", nombre: "Ahorro", tipo: "ahorro", banco: "", saldo: 0, currency: "EUR", objetivo: null, limite_mensual: null, color: "#3b82f6" },
    { id: "acc_inversion", nombre: "Inversión", tipo: "inversion", banco: "", saldo: 0, currency: "EUR", objetivo: null, limite_mensual: null, color: "#8b5cf6" },
    { id: "acc_principal", nombre: "Principal", tipo: "efectivo", banco: "", saldo: 0, currency: "EUR", objetivo: null, limite_mensual: null, color: "#f59e0b" },
    { id: "acc_gastos", nombre: "Gastos Mes", tipo: "gastos", banco: "", saldo: 0, currency: "EUR", objetivo: null, limite_mensual: null, color: "#ef4444" },
  ],
  transactions: [],
  sinkingFunds: [],
  categories: DEFAULT_CATEGORIES,
}

function loadState(): FinanceState {
  if (typeof window === "undefined") return defaultState
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as FinanceState
      return normalizeFinanceState({ ...defaultState, ...parsed, categories: parsed.categories ?? defaultState.categories })
    }
  } catch {}
  return defaultState
}

function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case "SET_STATE":
      return normalizeFinanceState(action.payload)
    case "MERGE_SAMPLE":
      return {
        accounts: [...state.accounts, ...action.payload.accounts.filter((a: Account) => !state.accounts.some((ea) => ea.id === a.id))],
        transactions: [...state.transactions, ...action.payload.transactions],
        sinkingFunds: [...state.sinkingFunds, ...action.payload.sinkingFunds],
        categories: state.categories,
      }
    case "RESET":
      return defaultState
    case "ADD_ACCOUNT": {
      const newAccount = { ...action.payload }
      const newTransactions = [...state.transactions]
      if (newAccount.saldo !== 0) {
        newTransactions.push({
          id: `init_${newAccount.id}`,
          cuenta_id: newAccount.id,
          monto: newAccount.saldo,
          fecha: new Date().toISOString().split("T")[0],
          tipo: "ingreso",
          categoria: "Saldo inicial",
          es_necesidad: false,
          descripcion: `Saldo inicial de ${newAccount.nombre}`,
          tags: [],
        })
      }
      return { ...state, accounts: [...state.accounts, newAccount], transactions: newTransactions }
    }
    case "UPDATE_ACCOUNT":
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.payload.id ? action.payload : a)) }
    case "DELETE_ACCOUNT":
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
        transactions: state.transactions.filter((t) => t.cuenta_id !== action.payload),
        sinkingFunds: state.sinkingFunds.filter((s) => s.cuenta_id !== action.payload),
      }
    case "ADD_TRANSACTION":
      return {
        ...state,
        transactions: [...state.transactions, action.payload],
        accounts: state.accounts.map((a) =>
          a.id === action.payload.cuenta_id ? { ...a, saldo: a.saldo + signedAmount(action.payload) } : a
        ),
      }
    case "UPDATE_TRANSACTION":
      return updateTransactionWithBalance(state, action.payload)
    case "DELETE_TRANSACTION":
      return deleteTransactionWithBalance(state, action.payload)
    case "ADD_SINKING_FUND":
      return { ...state, sinkingFunds: [...state.sinkingFunds, action.payload] }
    case "UPDATE_SINKING_FUND":
      return { ...state, sinkingFunds: state.sinkingFunds.map((s) => (s.id === action.payload.id ? action.payload : s)) }
    case "DELETE_SINKING_FUND":
      return { ...state, sinkingFunds: state.sinkingFunds.filter((s) => s.id !== action.payload) }
    case "ADD_CATEGORY":
      return state.categories.includes(action.payload) ? state : { ...state, categories: [...state.categories, action.payload] }
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter((c) => c !== action.payload) }
    default:
      return state
  }
}

function isInitialTx(t: Transaction) {
  return t.categoria === "Saldo inicial" && t.id.startsWith("init_")
}

function signedAmount(t: Transaction): number {
  return t.tipo === "ingreso" ? t.monto : -t.monto
}

function updateTransactionWithBalance(state: FinanceState, updated: Transaction): FinanceState {
  const prev = state.transactions.find((t) => t.id === updated.id)
  if (!prev) return { ...state, transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)) }
  if (isInitialTx(prev)) return { ...state, transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)) }

  const withPrevReverted = state.accounts.map((a) =>
    a.id === prev.cuenta_id ? { ...a, saldo: a.saldo - signedAmount(prev) } : a
  )

  const withUpdatedApplied = withPrevReverted.map((a) =>
    a.id === updated.cuenta_id ? { ...a, saldo: a.saldo + signedAmount(updated) } : a
  )

  return {
    ...state,
    accounts: withUpdatedApplied,
    transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
  }
}

function deleteTransactionWithBalance(state: FinanceState, id: string): FinanceState {
  const deleted = state.transactions.find((t) => t.id === id)
  if (!deleted) return { ...state, transactions: state.transactions.filter((t) => t.id !== id) }
  if (isInitialTx(deleted)) return { ...state, transactions: state.transactions.filter((t) => t.id !== id) }

  return {
    ...state,
    transactions: state.transactions.filter((t) => t.id !== id),
    accounts: state.accounts.map((a) =>
      a.id === deleted.cuenta_id ? { ...a, saldo: a.saldo - signedAmount(deleted) } : a
    ),
  }
}

interface FinanceContextValue {
  state: FinanceState
  dispatch: React.Dispatch<Action>
  loading: boolean
  syncStatus: SyncStatus
}

const FinanceContext = createContext<FinanceContextValue | null>(null)

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const loadedRef = useRef(false)
  const syncChainRef = useRef(Promise.resolve())

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null
    if (saved) {
      dispatch({ type: "SET_STATE", payload: loadState() })
    } else {
      loadFromSupabase().then((remote) => {
        if (remote && (remote.accounts.length > 0 || remote.transactions.length > 0 || remote.sinkingFunds.length > 0)) {
          dispatch({ type: "SET_STATE", payload: remote })
        } else {
          dispatch({ type: "SET_STATE", payload: defaultState })
        }
      }).catch(() => {
        dispatch({ type: "SET_STATE", payload: defaultState })
      }).finally(() => {
        setLoading(false)
      })
      return
    }

    loadFromSupabase().catch(() => {}).finally(() => {
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!loadedRef.current) return
    if (state !== defaultState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      let cancelled = false
      setSyncStatus("syncing")
      syncChainRef.current = syncChainRef.current
        .then(() => syncToSupabase(state))
        .then(() => {
          if (!cancelled) setSyncStatus("saved")
        })
        .catch(() => {
          if (!cancelled) setSyncStatus("error")
        })
      return () => {
        cancelled = true
      }
    }
  }, [state])

  return <FinanceContext.Provider value={{ state, dispatch, loading, syncStatus }}>{children}</FinanceContext.Provider>
}

async function loadFromSupabase(): Promise<FinanceState | null> {
  try {
    const [accRes, txRes, sfRes] = await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("transactions").select("*"),
      supabase.from("sinking_funds").select("*"),
    ])
    if (accRes.error || txRes.error || sfRes.error) return null
    if (!accRes.data || !txRes.data || !sfRes.data) return null
    if (accRes.data.length === 0 && txRes.data.length === 0) return null
    return {
      accounts: accRes.data.map(formatAccount),
      transactions: txRes.data.map(formatTransaction),
      sinkingFunds: sfRes.data.map(formatSinkingFund),
      categories: DEFAULT_CATEGORIES,
    }
  } catch {
    return null
  }
}

async function syncToSupabase(state: FinanceState) {
  const { error: accErr } = await supabase.from("accounts").upsert(state.accounts.map(unformatAccount))
  if (accErr) throw accErr

  const { error: txErr } = await supabase.from("transactions").upsert(state.transactions.map(unformatTransaction))
  if (txErr) throw txErr

  const { error: sfErr } = await supabase.from("sinking_funds").upsert(state.sinkingFunds.map(unformatSinkingFund))
  if (sfErr) throw sfErr

  await deleteRemoteMissingRows("transactions", state.transactions.map((t) => t.id))
  await deleteRemoteMissingRows("sinking_funds", state.sinkingFunds.map((s) => s.id))
  await deleteRemoteMissingRows("accounts", state.accounts.map((a) => a.id))
}

async function deleteRemoteMissingRows(table: "accounts" | "transactions" | "sinking_funds", localIds: string[]) {
  const { data, error } = await supabase.from(table).select("id")
  if (error) throw error

  const remoteIds = (data ?? []).map((row: { id: string }) => row.id)
  const missing = remoteIds.filter((id) => !localIds.includes(id))
  if (missing.length === 0) return

  const { error: deleteErr } = await supabase.from(table).delete().in("id", missing)
  if (deleteErr) throw deleteErr
}

function formatAccount(a: any): Account {
  return { id: a.id, nombre: a.nombre, tipo: a.tipo, banco: a.banco ?? "", saldo: Number(a.saldo), currency: a.currency ?? "EUR", objetivo: a.objetivo ? Number(a.objetivo) : null, limite_mensual: a.limite_mensual ? Number(a.limite_mensual) : null, color: a.color ?? "#3b82f6" }
}

function normalizeFinanceState(state: FinanceState): FinanceState {
  const accounts = state.accounts.map((account) => ({ ...account, currency: account.currency ?? "EUR" }))
  const transactions = [...state.transactions]
  for (const account of accounts) {
    if (account.saldo !== 0 && !transactions.some((t) => t.cuenta_id === account.id && t.categoria === "Saldo inicial")) {
      const ids = transactions.filter((t) => t.cuenta_id === account.id).map((t) => t.id)
      const hasInitTx = ids.some((id) => typeof id === "string" && id.startsWith(`init_${account.id}`))
      if (!hasInitTx) {
        const txDates = transactions.filter((t) => t.cuenta_id === account.id).map((t) => t.fecha).sort()
        const fecha = txDates.length > 0 ? txDates[0] : new Date().toISOString().split("T")[0]
        transactions.push({
          id: `init_${account.id}`,
          cuenta_id: account.id,
          monto: account.saldo,
          fecha,
          tipo: "ingreso",
          categoria: "Saldo inicial",
          es_necesidad: false,
          descripcion: `Saldo inicial de ${account.nombre}`,
          tags: [],
        })
      }
    }
  }
  return { ...state, accounts, transactions }
}

function formatTransaction(t: any): Transaction {
  return { id: t.id, cuenta_id: t.cuenta_id, monto: Number(t.monto), fecha: t.fecha, tipo: t.tipo, categoria: t.categoria, es_necesidad: t.es_necesidad, descripcion: t.descripcion ?? "", tags: t.tags ?? [] }
}

function formatSinkingFund(s: any): SinkingFund {
  return { id: s.id, nombre: s.nombre, cantidad_objetivo: Number(s.objetivo), fecha_limite: s.fecha_limite ?? "", ahorrado_actual: Number(s.ahorrado), cuenta_id: s.cuenta_id ?? "" }
}

function unformatAccount(a: Account): any {
  return { id: a.id, nombre: a.nombre, tipo: a.tipo, banco: a.banco, saldo: a.saldo, currency: a.currency, objetivo: a.objetivo, limite_mensual: a.limite_mensual, color: a.color }
}

function unformatTransaction(t: Transaction): any {
  return { id: t.id, cuenta_id: t.cuenta_id, monto: t.monto, fecha: t.fecha, tipo: t.tipo, categoria: t.categoria, es_necesidad: t.es_necesidad, descripcion: t.descripcion, tags: t.tags }
}

function unformatSinkingFund(s: SinkingFund): any {
  return { id: s.id, nombre: s.nombre, objetivo: s.cantidad_objetivo, ahorrado: s.ahorrado_actual, fecha_limite: s.fecha_limite || null }
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

const BACKUP_KEY = "app-finanzas-backup"

export function backupCurrentState(state: FinanceState) {
  if (typeof window === "undefined") return
  localStorage.setItem(BACKUP_KEY, JSON.stringify(state))
}

export function restoreBackup(): FinanceState | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem(BACKUP_KEY)
    return saved ? JSON.parse(saved) : null
  } catch {
    return null
  }
}

export function clearBackup() {
  if (typeof window === "undefined") return
  localStorage.removeItem(BACKUP_KEY)
}

export function generateSampleData(): FinanceState {
  const sampleAccounts: Account[] = [
    { id: "s_acc_emergency", nombre: "Emergencias", tipo: "emergencia", banco: "Trade Republic", saldo: 8250, currency: "EUR", objetivo: 15000, limite_mensual: null, color: "#10b981" },
    { id: "s_acc_ahorro", nombre: "Ahorro", tipo: "ahorro", banco: "MyInvestor", saldo: 3400, currency: "USD", objetivo: 20000, limite_mensual: null, color: "#3b82f6" },
    { id: "s_acc_inversion", nombre: "Inversión", tipo: "inversion", banco: "Interactive Brokers", saldo: 12750, currency: "CHF", objetivo: null, limite_mensual: null, color: "#8b5cf6" },
    { id: "s_acc_principal", nombre: "Principal", tipo: "efectivo", banco: "BBVA", saldo: 2200, currency: "EUR", objetivo: null, limite_mensual: null, color: "#f59e0b" },
    { id: "s_acc_gastos", nombre: "Gastos Mes", tipo: "gastos", banco: "Revolut", saldo: 500, currency: "EUR", objetivo: null, limite_mensual: 2000, color: "#ef4444" },
  ]

  const months = [0, 1, 2, 3, 4, 5]
  const sampleTransactions: Transaction[] = []
  let idCounter = 0
  const now = new Date()

  for (const offset of months) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")

    sampleTransactions.push(
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_principal", monto: 3200, fecha: `${y}-${m}-15`, tipo: "ingreso", categoria: "Salario", es_necesidad: true, descripcion: "Nómina mensual", tags: ["recurrente"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_principal", monto: 850, fecha: `${y}-${m}-12`, tipo: "gasto", categoria: "Alquiler", es_necesidad: true, descripcion: "Alquiler piso", tags: ["recurrente", "vivienda"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_gastos", monto: 100 + Math.round(Math.random() * 80), fecha: `${y}-${m}-10`, tipo: "gasto", categoria: "Supermercado", es_necesidad: true, descripcion: "Compra semanal", tags: ["alimentación"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_principal", monto: 45, fecha: `${y}-${m}-08`, tipo: "gasto", categoria: "Transporte", es_necesidad: true, descripcion: "Abono mensual", tags: ["recurrente", "transporte"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_principal", monto: 55, fecha: `${y}-${m}-05`, tipo: "gasto", categoria: "Internet", es_necesidad: true, descripcion: "Fibra óptica", tags: ["recurrente", "suscripción"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_gastos", monto: 60 + Math.round(Math.random() * 40), fecha: `${y}-${m}-20`, tipo: "gasto", categoria: "Cena", es_necesidad: false, descripcion: "Restaurante", tags: ["ocio"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_gastos", monto: 9.99, fecha: `${y}-${m}-01`, tipo: "gasto", categoria: "Spotify", es_necesidad: false, descripcion: "Suscripción música", tags: ["recurrente", "suscripción", "ocio"] },
      { id: `s_t${idCounter++}`, cuenta_id: "s_acc_ahorro", monto: 300, fecha: `${y}-${m}-28`, tipo: "gasto", categoria: "Transferencia", es_necesidad: false, descripcion: "Ahorro mensual", tags: ["ahorro"] },
    )
  }

  const sampleFunds: SinkingFund[] = [
    { id: "s_sf1", nombre: "Coche Nuevo", cantidad_objetivo: 25000, fecha_limite: "2027-12-31", ahorrado_actual: 5000, cuenta_id: "s_acc_ahorro" },
    { id: "s_sf2", nombre: "Viaje Verano 2027", cantidad_objetivo: 8000, fecha_limite: "2027-06-30", ahorrado_actual: 2000, cuenta_id: "s_acc_ahorro" },
  ]

  return { accounts: sampleAccounts, transactions: sampleTransactions, sinkingFunds: sampleFunds, categories: DEFAULT_CATEGORIES }
}
