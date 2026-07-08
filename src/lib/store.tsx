"use client"

import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, useState, type ReactNode } from "react"
import { dbSelect, dbUpsert, dbDeleteIn } from "./db-client"
import { type CurrencyCode, refreshExchangeRates } from "./currency"

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
  /** Logo subido por el usuario (Supabase Storage). Si no hay, se usa el logo de un banco reconocido o un icono por tipo. */
  logoUrl?: string
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
  // Momento real de creación del registro (no el día del movimiento, que es
  // `fecha`). Permite ordenar varias transacciones del mismo día en el
  // histórico de patrimonio. Opcional porque las filas anteriores a la
  // migración `supabase-transactions-timestamp.sql` no la tenían.
  created_at?: string
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

export type CategoryKind = "ingreso" | "gasto" | "both"

export interface Category {
  id: string
  name: string
  color: string
  kind?: CategoryKind
}

export interface Budget {
  id: string
  category_id: string
  amount: number
  month: string
  user_id: string
}

export interface FinanceState {
  accounts: Account[]
  transactions: Transaction[]
  sinkingFunds: SinkingFund[]
  categories: Category[]
  budgets: Budget[]
}

type SyncStatus = "idle" | "syncing" | "saved" | "error" | "offline"

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
  | { type: "RESET" }
  | { type: "ADD_CATEGORY"; payload: Omit<Category, 'id'> }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "ADD_BUDGET"; payload: Omit<Budget, 'id'> }
  | { type: "UPDATE_BUDGET"; payload: Budget }
  | { type: "DELETE_BUDGET"; payload: string }

// Categorías predeterminadas, separadas por tipo (ingreso / gasto / ambos).
const DEFAULT_CATEGORY_DEFS: { name: string; kind: CategoryKind }[] = [
  // Ingresos
  { name: "Salario", kind: "ingreso" },
  { name: "Freelance", kind: "ingreso" },
  { name: "Negocio", kind: "ingreso" },
  { name: "Inversión", kind: "ingreso" },
  { name: "Dividendos", kind: "ingreso" },
  { name: "Intereses", kind: "ingreso" },
  { name: "Rentas", kind: "ingreso" },
  { name: "Reembolso", kind: "ingreso" },
  { name: "Regalo", kind: "ingreso" },
  { name: "Venta", kind: "ingreso" },
  { name: "Bonus", kind: "ingreso" },
  { name: "Otros ingresos", kind: "ingreso" },
  // Gastos
  { name: "Supermercado", kind: "gasto" },
  { name: "Restaurantes", kind: "gasto" },
  { name: "Cena", kind: "gasto" },
  { name: "Transporte", kind: "gasto" },
  { name: "Coche", kind: "gasto" },
  { name: "Vivienda", kind: "gasto" },
  { name: "Alquiler", kind: "gasto" },
  { name: "Suministros", kind: "gasto" },
  { name: "Internet", kind: "gasto" },
  { name: "Móvil", kind: "gasto" },
  { name: "Suscripciones", kind: "gasto" },
  { name: "Spotify", kind: "gasto" },
  { name: "Ocio", kind: "gasto" },
  { name: "Ropa", kind: "gasto" },
  { name: "Salud", kind: "gasto" },
  { name: "Gym", kind: "gasto" },
  { name: "Educación", kind: "gasto" },
  { name: "Viajes", kind: "gasto" },
  { name: "Mascotas", kind: "gasto" },
  { name: "Regalos", kind: "gasto" },
  { name: "Impuestos", kind: "gasto" },
  { name: "Hogar", kind: "gasto" },
  { name: "Tecnología", kind: "gasto" },
  { name: "Otros gastos", kind: "gasto" },
  // Ambos
  { name: "Transferencia", kind: "both" },
  { name: "Otros", kind: "both" },
]

const CATEGORY_PALETTE = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"]

const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g")

function slugifyCategory(name: string): string {
  return "cat_" + name.toLowerCase().normalize("NFD").replace(DIACRITICS, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
}

const DEFAULT_CATEGORIES: Category[] = DEFAULT_CATEGORY_DEFS.map((d, i) => ({
  id: slugifyCategory(d.name),
  name: d.name,
  color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
  kind: d.kind,
}))

// Garantiza que existan todas las categorías predeterminadas y que cada categoría
// tenga `kind`. Rellena el tipo de las antiguas (por id) y deja las personalizadas
// sin tipo conocido como "both" para que sigan apareciendo en ambos formularios.
function mergeDefaultCategories(loaded: Category[]): Category[] {
  const existing = new Set(loaded.map((c) => c.id))
  const result: Category[] = loaded.map((c) => {
    if (c.kind) return c
    const def = DEFAULT_CATEGORIES.find((d) => d.id === c.id)
    return { ...c, kind: def?.kind ?? "both" }
  })
  for (const d of DEFAULT_CATEGORIES) if (!existing.has(d.id)) result.push(d)
  return result
}

type AccountRow = {
  id: string
  nombre: string
  tipo: Account["tipo"]
  banco: string | null
  saldo: number | string
  currency?: CurrencyCode | null
  objetivo: number | string | null
  limite_mensual: number | string | null
  color: string | null
  logo_url?: string | null
}

type TransactionRow = {
  id: string
  cuenta_id: string
  monto: number | string
  fecha: string
  tipo: Transaction["tipo"]
  categoria: string
  es_necesidad: boolean
  descripcion: string | null
  tags: unknown
  created_at?: string
}

type SinkingFundRow = {
  id: string
  nombre: string | null
  objetivo: number | string | null
  ahorrado: number | string | null
  fecha_limite: string | null
  cuenta_id?: string | null
}

type TransactionPayload = Omit<TransactionRow, "monto" | "tags" | "descripcion"> & { monto: number; tags: string[]; descripcion: string }

export const defaultState: FinanceState = {
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
  budgets: [],
}

export function reducer(state: FinanceState, action: Action): FinanceState {
  switch (action.type) {
    case "SET_STATE":
      return normalizeFinanceState(action.payload)
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
          created_at: new Date().toISOString(),
        })
      }
      return { ...state, accounts: [...state.accounts, newAccount], transactions: newTransactions }
    }
    case "UPDATE_ACCOUNT": {
      // Si se edita el saldo de una cuenta ya existente, generamos una transacción
      // de ajuste por la diferencia en vez de sobrescribir el campo a secas.
      // Si no, el saldo mostrado (dato persistido) se desincroniza silenciosamente
      // del historial de transacciones real (que es lo que usa el detalle de cuenta
      // para calcular ingresos/gastos/neto), como pasó con la cuenta "Papel".
      const prevAccount = state.accounts.find((a) => a.id === action.payload.id)
      const delta = prevAccount ? action.payload.saldo - prevAccount.saldo : 0
      const newTransactions =
        delta !== 0
          ? [
              ...state.transactions,
              {
                // Prefijo "adj_" para que isInitialBalanceTransaction() la excluya
                // de los totales de ingresos/gastos (no es actividad real del mes).
                id: `adj_${generateId()}`,
                cuenta_id: action.payload.id,
                monto: delta,
                fecha: new Date().toISOString().split("T")[0],
                tipo: "ingreso" as const,
                categoria: "Ajuste de saldo",
                es_necesidad: false,
                descripcion: `Ajuste de saldo de ${action.payload.nombre}`,
                tags: [],
                created_at: new Date().toISOString(),
              },
            ]
          : state.transactions
      return {
        ...state,
        accounts: state.accounts.map((a) => (a.id === action.payload.id ? action.payload : a)),
        transactions: newTransactions,
      }
    }
    case "DELETE_ACCOUNT":
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.payload),
        transactions: state.transactions.filter((t) => t.cuenta_id !== action.payload),
        sinkingFunds: state.sinkingFunds.filter((s) => s.cuenta_id !== action.payload),
      }
    case "ADD_TRANSACTION": {
      // created_at se fija aquí (punto único) en vez de en cada sitio que
      // despacha ADD_TRANSACTION, para poder ordenar por hora real de alta
      // varias transacciones del mismo día en el histórico de patrimonio.
      const newTransaction = { ...action.payload, created_at: action.payload.created_at ?? new Date().toISOString() }
      return {
        ...state,
        transactions: [...state.transactions, newTransaction],
        accounts: state.accounts.map((a) =>
          a.id === newTransaction.cuenta_id ? { ...a, saldo: a.saldo + signedAmount(newTransaction) } : a
        ),
      }
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
      // Comparación sin distinguir mayúsculas ni espacios sobrantes: mismo
      // criterio que el formulario de Configuración, aquí también por si
      // ADD_CATEGORY llega a dispararse alguna vez desde otro punto de la app.
      return state.categories.some((c) => c.name.trim().toLowerCase() === action.payload.name.trim().toLowerCase())
        ? state
        : { ...state, categories: [...state.categories, { id: generateId(), ...action.payload }] }
    case "DELETE_CATEGORY":
      // Al borrar una categoría también eliminamos sus presupuestos dependientes
      // (budgets.category_id → categories.id) para no dejar filas huérfanas ni
      // violar la FK al sincronizar el borrado con Supabase.
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
        budgets: state.budgets.filter((b) => b.category_id !== action.payload),
      }
    case "ADD_BUDGET":
      return { ...state, budgets: [...state.budgets, { id: generateId(), ...action.payload }] }
    case "UPDATE_BUDGET":
      return { ...state, budgets: state.budgets.map((b) => (b.id === action.payload.id ? action.payload : b)) }
    case "DELETE_BUDGET":
      return { ...state, budgets: state.budgets.filter((b) => b.id !== action.payload) }
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
}

const FinanceContext = createContext<FinanceContextValue | null>(null)
// El estado de sincronización vive en su propio contexto: cambia dos veces por
// cada dispatch ("syncing" → "saved") y solo lo consume el indicador del
// sidebar — si viviera en FinanceContext, cada sync re-renderizaría todos los
// consumidores de useFinance() de la app dos veces extra. `retrySync` es
// estable (useCallback), así que viaja aquí en vez de en FinanceContext: solo
// cambia la referencia del objeto cuando cambia `status`, no en cada dispatch.
interface SyncStatusContextValue {
  status: SyncStatus
  retrySync: () => void
}
const SyncStatusContext = createContext<SyncStatusContextValue>({ status: "idle", retrySync: () => {} })

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState)
  const [loading, setLoading] = useState(true)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle")
  const [initialized, setInitialized] = useState(false)
  const loadedRef = useRef(false)
  const syncChainRef = useRef(Promise.resolve())

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true

    // Los tipos de cambio en vivo se piden en paralelo con los datos, y ambos
    // terminan antes de quitar el loading: así ninguna cifra convertida entre
    // divisas llega a pintarse con los valores de respaldo desactualizados.
    Promise.all([loadFromSupabase(), refreshExchangeRates()]).then(([remote]) => {
      if (remote && (remote.accounts.length > 0 || remote.transactions.length > 0 || remote.sinkingFunds.length > 0)) {
        dispatch({ type: "SET_STATE", payload: { ...remote, categories: mergeDefaultCategories(remote.categories) } })
      } else {
        const local = loadLocalBackup()
        if (local && (local.accounts.length > 0 || local.transactions.length > 0 || local.sinkingFunds.length > 0)) {
          dispatch({ type: "SET_STATE", payload: { ...local, categories: mergeDefaultCategories(local.categories) } })
        }
      }
    }).finally(() => {
      setLoading(false)
      setInitialized(true)
    })
  }, [])

  // Una PWA anclada a la pantalla de inicio no se recarga al reabrirla: iOS
  // mantiene el mismo proceso web en segundo plano indefinidamente, así que
  // este componente nunca se vuelve a montar y loadedRef.current sigue en
  // true. Sin esto, cualquier cambio hecho desde otro sitio (otra pestaña,
  // el Atajo, otro dispositivo) se queda invisible hasta forzar una recarga
  // manual. Al recuperar el foco/visibilidad se vuelve a pedir todo a
  // Supabase, igual que en la carga inicial.
  // Solo "visibilitychange" (no "focus" ni "pageshow": disparan con mucha más
  // facilidad — p. ej. cada vez que un diálogo o input roba el foco — y aquí
  // solo interesa la transición real de app en segundo plano a primer plano).
  // El propio evento ya solo se dispara en transiciones reales según spec,
  // pero se añade además un margen mínimo entre refetch por seguridad.
  const lastRefetchRef = useRef(0)
  useEffect(() => {
    const refetchIfVisible = () => {
      if (document.visibilityState !== "visible") return
      const now = Date.now()
      if (now - lastRefetchRef.current < 10000) return
      lastRefetchRef.current = now
      loadFromSupabase().then((remote) => {
        if (remote && (remote.accounts.length > 0 || remote.transactions.length > 0 || remote.sinkingFunds.length > 0)) {
          dispatch({ type: "SET_STATE", payload: { ...remote, categories: mergeDefaultCategories(remote.categories) } })
        }
      })
    }
    document.addEventListener("visibilitychange", refetchIfVisible)
    return () => document.removeEventListener("visibilitychange", refetchIfVisible)
  }, [])

  // state en un ref: los reintentos disparados por setTimeout/eventos 'online'
  // deben sincronizar siempre el estado MÁS RECIENTE, no el que había en el
  // closure cuando se programó el reintento.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryAttemptRef = useRef(0)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  const clearRetry = useCallback(() => {
    if (retryTimeoutRef.current) { clearTimeout(retryTimeoutRef.current); retryTimeoutRef.current = null }
  }, [])

  // Backoff entre reintentos tras un fallo (3s, 8s, 20s, luego cada 30s): evita
  // machacar Supabase si está caído, pero sin dejar de intentarlo — cualquier
  // cambio de estado nuevo cancela este reintento y prueba de inmediato con el
  // dato fresco, así que en uso normal esto solo se nota si Supabase sigue
  // caído varios segundos seguidos.
  const RETRY_DELAYS = [3000, 8000, 20000, 30000]

  // attemptSync se reprograma a sí mismo vía setTimeout tras un fallo. Referenciar
  // la función directamente por su nombre dentro de su propio cuerpo dispara el
  // lint "accessed before it is declared" (y es fresco solo hasta que cambien sus
  // deps); pasando por un ref, el reintento programado siempre llama a la versión
  // más reciente sin ese problema.
  const attemptSyncRef = useRef<() => void>(() => {})

  const attemptSync = useCallback(() => {
    clearRetry()
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSyncStatus("offline")
      return
    }
    setSyncStatus("syncing")
    syncChainRef.current = syncChainRef.current
      .then(() => syncToSupabase(stateRef.current))
      .then(() => {
        if (!mountedRef.current) return
        retryAttemptRef.current = 0
        setSyncStatus("saved")
      })
      .catch((err) => {
        console.error("[Finance] Error al sincronizar con Supabase:", err)
        if (!mountedRef.current) return
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setSyncStatus("offline")
          return
        }
        setSyncStatus("error")
        const delay = RETRY_DELAYS[Math.min(retryAttemptRef.current, RETRY_DELAYS.length - 1)]
        retryAttemptRef.current++
        retryTimeoutRef.current = setTimeout(() => attemptSyncRef.current(), delay)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearRetry])

  useEffect(() => { attemptSyncRef.current = attemptSync }, [attemptSync])

  const retrySync = useCallback(() => {
    retryAttemptRef.current = 0
    attemptSync()
  }, [attemptSync])

  useEffect(() => {
    if (!initialized) return
    // Copia de seguridad local en cada cambio (red de seguridad ante pérdidas en
    // Supabase). La app la usa como fallback si Supabase está vacío/caído.
    try { localStorage.setItem("app-finanzas-data", JSON.stringify(state)) } catch {}
    retryAttemptRef.current = 0
    // attemptSync() refleja en la UI ("syncing") el inicio de la sincronización
    // con Supabase (sistema externo) — uso previsto de un efecto, igual que antes
    // de que este cuerpo se moviera a una función reutilizable por los reintentos.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    attemptSync()
    return clearRetry
  }, [state, initialized, attemptSync, clearRetry])

  // Si el navegador pierde la conexión, no tiene sentido seguir reintentando
  // cada pocos segundos (solo va a fallar); en cuanto vuelve, se reintenta ya.
  useEffect(() => {
    const handleOnline = () => { retryAttemptRef.current = 0; attemptSync() }
    const handleOffline = () => { clearRetry(); setSyncStatus("offline") }
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [attemptSync, clearRetry])

  // Memoizado: si no, este objeto se recrea en cada render de FinanceProvider
  // (aunque state/loading no hayan cambiado) y como Context re-renderiza a
  // todos los consumidores cuando su `value` cambia de referencia, cualquier
  // cambio en cualquier parte del árbol forzaba un re-render de absolutamente
  // todo lo que usa useFinance() en la app.
  const contextValue = useMemo(() => ({ state, dispatch, loading }), [state, loading])
  const syncStatusValue = useMemo(() => ({ status: syncStatus, retrySync }), [syncStatus, retrySync])

  return (
    <FinanceContext.Provider value={contextValue}>
      <SyncStatusContext.Provider value={syncStatusValue}>{children}</SyncStatusContext.Provider>
    </FinanceContext.Provider>
  )
}

async function loadFromSupabase(): Promise<FinanceState | null> {
  try {
    const [accData, txData, sfData, catData, budData] = await Promise.all([
      dbSelect<AccountRow>("accounts"),
      dbSelect<TransactionRow>("transactions"),
      dbSelect<SinkingFundRow>("sinking_funds"),
      dbSelect<Category>("categories"),
      dbSelect<Budget>("budgets"),
    ])
    if (!accData || !txData || !sfData || !catData || !budData) return null
    return {
      accounts: accData.map(formatAccount),
      transactions: txData.map(formatTransaction),
      sinkingFunds: sfData.map(formatSinkingFund),
      categories: catData,
      budgets: budData,
    }
  } catch {
    return null
  }
}

export const USER_ID = '8c449806-d8b4-498a-98d7-28809bb7c95a'

async function syncToSupabase(state: FinanceState) {
  await dbUpsert("accounts", state.accounts.map(a => ({ ...unformatAccount(a), user_id: USER_ID })))
  await dbUpsert("transactions", state.transactions.map(t => ({ ...unformatTransaction(t), user_id: USER_ID })))
  await dbUpsert("sinking_funds", state.sinkingFunds.map(sf => ({ ...unformatSinkingFund(sf), user_id: USER_ID })))
  await dbUpsert("categories", state.categories.map(c => ({ ...c, user_id: USER_ID })))
  // Los presupuestos deben subirse DESPUÉS de las categorías: budgets.category_id
  // tiene una FK a categories.id, así que la categoría referenciada ya debe existir.
  await dbUpsert("budgets", state.budgets.map(b => ({ id: b.id, category_id: b.category_id, amount: b.amount, month: b.month, user_id: USER_ID })))

  await deleteRemoteMissingRows("transactions", state.transactions.map((t) => t.id))
  await deleteRemoteMissingRows("sinking_funds", state.sinkingFunds.map((s) => s.id))
  await deleteRemoteMissingRows("accounts", state.accounts.map((a) => a.id))
  await deleteRemoteMissingRows("budgets", state.budgets.map((b) => b.id))
  // Las categorías se borran DESPUÉS de los presupuestos: como budgets.category_id
  // tiene una FK a categories.id, primero deben desaparecer los presupuestos que
  // referencian la categoría eliminada (ya los quitamos en DELETE_CATEGORY). La
  // salvaguarda anti-borrado-masivo de deleteRemoteMissingRows evita perder datos
  // si el estado local llega parcial.
  await deleteRemoteMissingRows("categories", state.categories.map((c) => c.id))
}

function loadLocalBackup(): FinanceState | null {
  if (typeof window === "undefined") return null
  try {
    const saved = localStorage.getItem("app-finanzas-data")
    if (!saved) return null
    const parsed = JSON.parse(saved) as FinanceState
    if (!parsed.accounts?.length && !parsed.transactions?.length && !parsed.sinkingFunds?.length) return null
    console.warn("[Finance] Recuperando datos de localStorage (Supabase no tenía datos)")
    return { ...parsed, categories: parsed.categories ?? DEFAULT_CATEGORIES }
  } catch {
    return null
  }
}

async function deleteRemoteMissingRows(table: "accounts" | "transactions" | "sinking_funds" | "budgets" | "categories", localIds: string[]) {
  // Para "transactions" también se leen los tags: las filas con "atajo" las
  // crea /api/shortcuts/movement directamente en Supabase, fuera de este
  // reducer, así que ninguna pestaña abierta las tiene en su estado local
  // todavía. Sin esta excepción, este borrado-espejo las trataba como "el
  // usuario las borró" y las eliminaba a los pocos segundos de crearse.
  type RowWithTags = { id: string; tags?: unknown }
  const data = await dbSelect<RowWithTags>(table, table === "transactions" ? "id, tags" : "id")
  if (!data) throw new Error(`No se pudo leer "${table}" para sincronizar borrados`)

  const remoteIds = data
    .filter((row) => !(Array.isArray(row.tags) && row.tags.includes("atajo")))
    .map((row) => row.id)
  const localSet = new Set(localIds)
  const missing = remoteIds.filter((id) => !localSet.has(id))
  if (missing.length === 0) return

  // Salvaguarda anti-pérdida de datos: si "faltan" muchas filas a la vez, casi
  // seguro el estado local está desincronizado/parcial (otra pestaña, carga
  // antigua, etc.), NO un borrado real del usuario. No borramos en masa.
  if (missing.length > 5 && missing.length > remoteIds.length * 0.4) {
    console.warn(`[Finance] Borrado masivo evitado en "${table}": ${missing.length}/${remoteIds.length} filas no estaban en el estado local. Estado probablemente parcial; no se borra nada.`)
    return
  }

  await dbDeleteIn(table, missing)
}

function formatAccount(a: AccountRow): Account {
  return { id: a.id, nombre: a.nombre, tipo: a.tipo, banco: a.banco ?? "", saldo: Number(a.saldo), currency: a.currency ?? "EUR", objetivo: a.objetivo ? Number(a.objetivo) : null, limite_mensual: a.limite_mensual ? Number(a.limite_mensual) : null, color: a.color ?? "#3b82f6", logoUrl: a.logo_url ?? undefined }
}

function normalizeFinanceState(state: FinanceState): FinanceState {
  const accounts = state.accounts.map((account) => ({ ...account, currency: account.currency ?? "EUR" }))
  const transactions = [...state.transactions]
  for (const account of accounts) {
    if (account.saldo !== 0 && !transactions.some((t) => t.cuenta_id === account.id && (t.categoria === "Saldo inicial" || t.id.startsWith(`init_${account.id}`)))) {
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

function formatTransaction(t: TransactionRow): Transaction {
  return { id: t.id, cuenta_id: t.cuenta_id, monto: Number(t.monto), fecha: t.fecha, tipo: t.tipo, categoria: t.categoria, es_necesidad: t.es_necesidad, descripcion: t.descripcion ?? "", tags: Array.isArray(t.tags) ? t.tags.map(String) : [], created_at: t.created_at }
}

function formatSinkingFund(s: SinkingFundRow): SinkingFund {
  return { id: s.id, nombre: s.nombre ?? "", cantidad_objetivo: Number(s.objetivo) || 0, fecha_limite: s.fecha_limite ?? "", ahorrado_actual: Number(s.ahorrado) || 0, cuenta_id: s.cuenta_id ?? "" }
}

function unformatAccount(a: Account) {
  const base: Record<string, unknown> = { id: a.id, nombre: a.nombre, tipo: a.tipo, banco: a.banco, saldo: a.saldo, currency: a.currency, objetivo: a.objetivo, limite_mensual: a.limite_mensual, color: a.color }
  // Solo se envía si el valor viene de AccountDialog (que siempre manda un
  // string, "" incluido al quitar el logo): así las cuentas que nunca han
  // pasado por ahí siguen sincronizando aunque la migración SQL
  // (supabase-account-logo.sql) no se haya ejecutado todavía (columna
  // logo_url inexistente rompería el upsert entero). Comparar con `!= null`
  // en vez de `!== undefined` haría que quitar el logo (string vacío) nunca
  // se enviara, dejando el logo antiguo huérfano en Supabase.
  if (a.logoUrl !== undefined) base.logo_url = a.logoUrl || null
  return base
}

function unformatTransaction(t: Transaction): TransactionPayload {
  // created_at NO se manda: la columna la rellena Supabase con su propio
  // default (now()) al insertar, y así el guardado sigue funcionando aunque
  // todavía no se haya ejecutado supabase-transactions-timestamp.sql.
  return { id: t.id, cuenta_id: t.cuenta_id, monto: t.monto, fecha: t.fecha, tipo: t.tipo, categoria: t.categoria, es_necesidad: t.es_necesidad, descripcion: t.descripcion, tags: t.tags }
}

function unformatSinkingFund(s: SinkingFund) {
  return {
    id: s.id, nombre: s.nombre, objetivo: s.cantidad_objetivo, ahorrado: s.ahorrado_actual, fecha_limite: s.fecha_limite || null,
    // Solo se envía cuando hay cuenta vinculada, para que una meta sin vincular
    // siga sincronizando aunque supabase-sinkingfunds-cuenta.sql no se haya
    // ejecutado todavía (la columna cuenta_id es nueva).
    ...(s.cuenta_id ? { cuenta_id: s.cuenta_id } : {}),
  }
}

export function useFinance() {
  const ctx = useContext(FinanceContext)
  if (!ctx) throw new Error("useFinance must be used within FinanceProvider")
  return ctx
}

export function useSyncStatus() {
  return useContext(SyncStatusContext)
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? (Date.now().toString(36) + Math.random().toString(36).slice(2, 7))
}
