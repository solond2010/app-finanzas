"use client"

import { useState, useMemo, useRef, Fragment, type CSSProperties } from "react"
import { useSearchParams } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useFinance, type Transaction, type Category, generateId } from "@/lib/store"
import { dbDeleteEq } from "@/lib/db-client"
import { Filter, Plus, Pencil, Trash2, Search, Download, AlertCircle, X, ArrowLeftRight, Repeat, ChevronLeft, ChevronRight, CalendarDays, List, TrendingDown, TrendingUp, SlidersHorizontal, Copy } from "lucide-react"
import { parseAmount } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatMoney, convertToEur, currencySymbol, type CurrencyCode } from "@/lib/currency"
import { dateLabel, isInitialBalanceTransaction } from "@/lib/format"
import { parseLocalDate } from "@/lib/date-utils"
import { Sensitive } from "@/components/shared/sensitive"
import { filterTransactionsByMonth, isTransfer, isRecurringTransaction, recurringFrequency, recurringTag, type RecurringFrequency } from "@/lib/calculations"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"

// Estilo del chip de categoría a partir del color REAL de la categoría (el
// hex que el usuario ve en Configuración y en el punto de la descripción),
// en vez del antiguo mapa hardcodeado que solo cubría 12 nombres y dejaba el
// resto en gris. El texto se acerca al foreground con color-mix para que
// contraste en ambos temas (en claro oscurece el tono, en oscuro lo aclara).
function categoryChipStyle(hex: string | undefined): CSSProperties | undefined {
  if (!hex) return undefined
  return {
    backgroundColor: `color-mix(in oklch, ${hex}, transparent 88%)`,
    color: `color-mix(in oklch, ${hex}, var(--foreground) 45%)`,
    boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${hex}, transparent 75%)`,
  }
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function TransactionForm({
  transaction,
  accounts,
  categories,
  onSave,
  onCancel,
}: {
  transaction?: Transaction
  accounts: { id: string; nombre: string; currency?: CurrencyCode }[]
  categories: Category[]
  onSave: (t: Transaction) => void
  onCancel: () => void
}) {
  const today = localDateKey()
  const [cuentaId, setCuentaId] = useState(transaction?.cuenta_id ?? accounts[0]?.id ?? "")
  const [monto, setMonto] = useState(String(transaction?.monto ?? ""))
  const [fecha, setFecha] = useState(transaction?.fecha ?? today)
  const [tipo, setTipo] = useState<"ingreso" | "gasto">(transaction?.tipo ?? "gasto")
  const [categoria, setCategoria] = useState(transaction?.categoria ?? "")
  const [esNecesidad, setEsNecesidad] = useState(transaction?.es_necesidad ?? false)
  const [descripcion, setDescripcion] = useState(transaction?.descripcion ?? "")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>(transaction?.tags ?? [])
  const [recurFreq, setRecurFreq] = useState<RecurringFrequency>(transaction ? recurringFrequency(transaction) : "mensual")
  const [error, setError] = useState("")

  const visibleCategories = categories
    .filter((c) => !c.kind || c.kind === tipo || c.kind === "both")
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  const changeTipo = (next: "ingreso" | "gasto") => {
    setTipo(next)
    const stillValid = categories.some((c) => c.name === categoria && (!c.kind || c.kind === next || c.kind === "both"))
    if (!stillValid) setCategoria("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!cuentaId) { setError("Selecciona una cuenta."); return }
    if (!fecha) { setError("Indica una fecha."); return }
    if (!categoria) { setError("Selecciona una categoría."); return }
    const amount = parseAmount(monto)
    if (!amount) { setError("Indica un importe válido mayor que 0."); return }
    onSave({
      id: transaction?.id ?? generateId(),
      cuenta_id: cuentaId,
      monto: amount,
      fecha,
      tipo,
      categoria,
      es_necesidad: esNecesidad,
      descripcion,
      tags,
    })
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      setTags([...tags, t])
      setTagInput("")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="transaction-account" className="text-xs text-muted-foreground">Cuenta</label>
          <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
            <SelectTrigger id="transaction-account"><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: "gasto" as const, label: "Gasto" },
              { value: "ingreso" as const, label: "Ingreso" },
            ]).map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => changeTipo(t.value)}
                className={cn(
              "min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-all active:scale-[0.98]",
                  tipo === t.value
                    ? t.value === "gasto"
                      ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="transaction-amount" className="text-xs text-muted-foreground">Monto ({currencySymbol((accounts.find((a) => a.id === cuentaId)?.currency ?? "EUR") as CurrencyCode)})</label>
          <Input id="transaction-amount" inputMode="decimal" type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="transaction-date" className="text-xs text-muted-foreground">Fecha</label>
          <Input id="transaction-date" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="transaction-category" className="text-xs text-muted-foreground">Categoría</label>
          <Select value={categoria} onValueChange={(v) => v && setCategoria(v)}>
            <SelectTrigger id="transaction-category"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="transaction-description" className="text-xs text-muted-foreground">Descripción</label>
          <Input id="transaction-description" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">Clasificación</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setEsNecesidad(true)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all",
                esNecesidad
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-border text-muted-foreground hover:bg-muted/60"
              )}
            >
              Necesidad
            </button>
            <button
              type="button"
              onClick={() => setEsNecesidad(false)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all",
                !esNecesidad
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border text-muted-foreground hover:bg-muted/60"
              )}
            >
              Deseo
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tags.some((t) => t === "recurrente" || t.startsWith("recurrente:"))}
            onChange={(e) => {
              const withoutRecurring = tags.filter((t) => t !== "recurrente" && !t.startsWith("recurrente:"))
              setTags(e.target.checked ? [...withoutRecurring, recurringTag(recurFreq)] : withoutRecurring)
            }}
            className="rounded border-muted-foreground"
          />
          <span className="text-sm text-muted-foreground">Es recurrente</span>
        </label>
        {tags.some((t) => t === "recurrente" || t.startsWith("recurrente:")) && (
          <Select
            value={recurFreq}
            onValueChange={(v) => {
              const freq = v as RecurringFrequency
              setRecurFreq(freq)
              setTags([...tags.filter((t) => t !== "recurrente" && !t.startsWith("recurrente:")), recurringTag(freq)])
            }}
          >
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensual">Mensual</SelectItem>
              <SelectItem value="anual">Anual</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Tags</label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="Ej: suscripción"
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addTag}>+</Button>
        </div>
        {tags.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1">
            {tags.map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs">
                {tag}
                <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" aria-live="assertive" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm" className="min-h-11">{transaction ? "Guardar" : "Crear"}</Button>
      </div>
    </form>
  )
}

type EditField = "fecha" | "descripcion" | "categoria" | "monto"

// Enter guarda y desenfoca; Escape desenfoca sin guardar. El blur real
// (click fuera, o el que dispara el .blur() de Enter/Escape) es el único
// punto que llama a onDone, evitando doble commit.
function InlineEditInput({
  defaultValue,
  type = "text",
  onDone,
}: {
  defaultValue: string
  type?: "text" | "number" | "date"
  onDone: (committed: boolean, value: string) => void
}) {
  const shouldCommit = useRef(true)
  return (
    <input
      autoFocus
      type={type}
      step={type === "number" ? "0.01" : undefined}
      min={type === "number" ? "0" : undefined}
      defaultValue={defaultValue}
      className="w-full min-w-0 rounded-md border border-ring bg-background px-1.5 py-0.5 text-xs outline-none ring-2 ring-ring/25 transition-shadow sm:text-sm"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") { shouldCommit.current = true; e.currentTarget.blur() }
        else if (e.key === "Escape") { shouldCommit.current = false; e.currentTarget.blur() }
      }}
      onBlur={(e) => onDone(shouldCommit.current, e.currentTarget.value)}
    />
  )
}

function InlineEditSelect({
  defaultValue,
  options,
  onDone,
}: {
  defaultValue: string
  options: { value: string; label: string }[]
  onDone: (committed: boolean, value: string) => void
}) {
  return (
    <select
      autoFocus
      defaultValue={defaultValue}
      className="w-full min-w-0 rounded-md border border-ring bg-background px-1.5 py-0.5 text-xs outline-none ring-2 ring-ring/25 transition-shadow"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === "Escape") { e.currentTarget.blur(); onDone(false, defaultValue) } }}
      onChange={(e) => onDone(true, e.target.value)}
      onBlur={() => onDone(false, defaultValue)}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

export function TransactionsTable({
  cuentaId,
  selectedMonth,
  onMonthChange,
  onToday,
  mobileSummary,
}: {
  cuentaId?: string
  selectedMonth?: string
  onMonthChange?: (delta: number) => void
  onToday?: () => void
  mobileSummary?: { ingresos: number; gastos: number; neto: number }
}) {
  const { state, loading, dispatch } = useFinance()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [filterAccount, setFilterAccount] = useState<string>(cuentaId ?? "all")
  const [filterCategory, setFilterCategory] = useState<string>(() => {
    const requested = searchParams.get("categoria")?.trim()
    return requested ? requested.slice(0, 100) : "all"
  })
  // Permite llegar aquí desde otra página con el tipo ya filtrado, ej. al
  // pinchar el ticker "Ingresos"/"Gastos" del Dashboard (/transactions?tipo=...).
  const [filterTipo, setFilterTipo] = useState<"all" | "ingreso" | "gasto" | "traspaso">(() => {
    const tipo = searchParams.get("tipo")
    return tipo === "ingreso" || tipo === "gasto" || tipo === "traspaso" ? tipo : "all"
  })
  const [search, setSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest")
  const [page, setPage] = useState(0)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditField } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const [showAdjustments, setShowAdjustments] = useState(false)
  const [mobileView, setMobileView] = useState<"list" | "calendar">("calendar")
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => ({ month: "", day: localDateKey() }))
  const mobileMode = selectedMonth && !cuentaId ? mobileView : "list"
  const PAGE_SIZE = 25


  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  const clearSelection = () => setSelectedIds(new Set())
  const bulkDelete = () => {
    const deletableIds = [...selectedIds].filter((id) => !isInitialBalanceTransaction(id))
    for (const id of deletableIds) {
      dispatch({ type: "DELETE_TRANSACTION", payload: id })
      dbDeleteEq("transactions", "id", id).then(() => {}, () => {})
    }
    toast(`${deletableIds.length} transacciones eliminadas`, "success")
    clearSelection()
    setBulkDeleteConfirm(false)
  }
  const bulkRecategorize = (categoria: string) => {
    for (const t of state.transactions) {
      if (selectedIds.has(t.id)) dispatch({ type: "UPDATE_TRANSACTION", payload: { ...t, categoria } })
    }
    toast(`${selectedIds.size} transacciones recategorizadas`, "success")
    clearSelection()
  }

  const duplicateTransaction = (transaction: Transaction) => {
    if (isTransfer(transaction) || isInitialBalanceTransaction(transaction.id)) return
    dispatch({
      type: "ADD_TRANSACTION",
      payload: {
        ...transaction,
        id: generateId(),
        fecha: localDateKey(),
        created_at: new Date().toISOString(),
        tags: transaction.tags.filter((tag) => tag !== "recurrente" && !tag.startsWith("recurrente:")),
      },
    })
    toast("Movimiento duplicado para hoy", "success")
  }

  const handleAccountFilter = (value: string | null) => {
    if (value) { setFilterAccount(value); setPage(0) }
  }
  const handleCategoryFilter = (value: string | null) => {
    if (value) { setFilterCategory(value); setPage(0) }
  }
  const handleTipoFilter = (value: "all" | "ingreso" | "gasto" | "traspaso") => {
    setFilterTipo(value); setPage(0)
  }
  const hasActiveFilters = filterAccount !== "all" || filterCategory !== "all" || filterTipo !== "all" || search !== ""
  const activeFiltersCount = Number(filterAccount !== "all") + Number(filterCategory !== "all") + Number(filterTipo !== "all") + Number(search !== "")
  const clearFilters = () => {
    if (!cuentaId) setFilterAccount("all")
    setFilterCategory("all")
    setFilterTipo("all")
    setSearch("")
    setPage(0)
  }

  const exportCSV = () => {
    const headers = ["fecha", "tipo", "categoria", "descripcion", "monto", "cuenta", "divisa", "tags"]
    const rows = state.transactions.map((t) => {
      const account = state.accounts.find((a) => a.id === t.cuenta_id)
      const values = [
        t.fecha,
        t.tipo,
        `"${t.categoria.replaceAll('"', '""')}"`,
        `"${t.descripcion.replaceAll('"', '""')}"`,
        t.monto,
        `"${(account?.nombre ?? "").replaceAll('"', '""')}"`,
        account?.currency ?? "EUR",
        `"${t.tags.join(", ").replaceAll('"', '""')}"`,
      ]
      return values.join(",")
    })

    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `movimientos_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, "")}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast("CSV exportado", "success")
  }

  const handleInlineDone = (t: Transaction, field: EditField, committed: boolean, rawValue: string) => {
    setEditingCell(null)
    if (isInitialBalanceTransaction(t.id)) return
    if (!committed) return
    if (field === "descripcion") {
      dispatch({ type: "UPDATE_TRANSACTION", payload: { ...t, descripcion: rawValue } })
    } else if (field === "categoria") {
      if (!rawValue || rawValue === t.categoria) return
      dispatch({ type: "UPDATE_TRANSACTION", payload: { ...t, categoria: rawValue } })
    } else if (field === "fecha") {
      if (!rawValue) return
      dispatch({ type: "UPDATE_TRANSACTION", payload: { ...t, fecha: rawValue } })
    } else if (field === "monto") {
      const monto = parseAmount(rawValue)
      if (!monto) { toast("Importe no válido: debe ser mayor que 0", "error"); return }
      dispatch({ type: "UPDATE_TRANSACTION", payload: { ...t, monto } })
    }
    toast("Transacción actualizada", "success")
  }

  const sorted = useMemo(
    () => {
      const safeTime = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime() }
      const orderIndex = new Map(state.transactions.map((t, i) => [t.id, i] as const))
      return filterTransactionsByMonth(state.transactions, selectedMonth)
        .filter((t) => showAdjustments || !isInitialBalanceTransaction(t.id))
        .filter((t) => filterAccount === "all" || t.cuenta_id === filterAccount)
        .filter((t) => filterCategory === "all" || t.categoria === filterCategory)
        .filter((t) => {
          if (filterTipo === "all") return true
          if (filterTipo === "traspaso") return isTransfer(t)
          return t.tipo === filterTipo && !isTransfer(t)
        })
        .filter((t) => !search || t.descripcion.toLowerCase().includes(search.toLowerCase()) || t.categoria.toLowerCase().includes(search.toLowerCase()) || t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) =>
          (sortOrder === "newest" ? safeTime(b.fecha) - safeTime(a.fecha) : safeTime(a.fecha) - safeTime(b.fecha))
          || safeTime(b.created_at ?? "") - safeTime(a.created_at ?? "")
          || (orderIndex.get(b.id) ?? 0) - (orderIndex.get(a.id) ?? 0)
        )
    },
    [state.transactions, filterAccount, filterCategory, filterTipo, search, selectedMonth, showAdjustments, sortOrder]
  )

  const grouped = useMemo(() => {
    const groups: { date: string; label: string; transactions: typeof sorted }[] = []
    for (const t of sorted) {
      const last = groups[groups.length - 1]
      if (last?.date === t.fecha) {
        last.transactions.push(t)
      } else {
        groups.push({ date: t.fecha, label: dateLabel(t.fecha), transactions: [t] })
      }
    }
    return groups
  }, [sorted])
  const calendarMonth = selectedMonth ?? localDateKey().slice(0, 7)
  const initialCalendarDay = useMemo(() => {
    const txDays = state.transactions
      .filter((t) => t.fecha.startsWith(calendarMonth) && !isInitialBalanceTransaction(t.id))
      .map((t) => t.fecha)
      .sort()
    const today = localDateKey()
    return today.startsWith(calendarMonth) ? today : txDays.at(-1) ?? `${calendarMonth}-01`
  }, [calendarMonth, state.transactions])
  const selectedDay = selectedCalendarDate.month === calendarMonth ? selectedCalendarDate.day : initialCalendarDay
  const selectedDayTransactions = grouped.find((group) => group.date === selectedDay)?.transactions ?? []

  const dailyTotals = useMemo(() => {
    const totals = new Map<string, { ingresos: number; gastos: number; count: number }>()
    for (const t of sorted) {
      const entry = totals.get(t.fecha) ?? { ingresos: 0, gastos: 0, count: 0 }
      const currency = state.accounts.find((a) => a.id === t.cuenta_id)?.currency ?? "EUR"
      const amount = convertToEur(t.monto, currency)
      if (!isTransfer(t) && !isInitialBalanceTransaction(t.id)) {
        if (t.tipo === "ingreso") entry.ingresos += amount
        else entry.gastos += amount
      }
      entry.count += 1
      totals.set(t.fecha, entry)
    }
    return totals
  }, [sorted, state.accounts])

  const [calendarYear, calendarMonthNumber] = calendarMonth.split("-").map(Number)
  const daysInMonth = new Date(calendarYear, calendarMonthNumber, 0).getDate()
  const leadingDays = (new Date(calendarYear, calendarMonthNumber - 1, 1).getDay() + 6) % 7
  const calendarCellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7
  const calendarMonthLabel = new Date(calendarYear, calendarMonthNumber - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" }).replace(/^./, (letter) => letter.toLocaleUpperCase("es-ES"))
  const selectedDayLabel = (() => {
    const [year, month, day] = selectedDay.split("-").map(Number)
    return new Date(year, month - 1, day).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
  })()
  const selectedDayStats = dailyTotals.get(selectedDay)
  const selectedDayNet = (selectedDayStats?.ingresos ?? 0) - (selectedDayStats?.gastos ?? 0)

  const categoryFilterOptions = useMemo(
    () => [...state.categories].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [state.categories]
  )

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const currentGrouped = useMemo(() => grouped.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE), [grouped, safePage])
  const mobileGroups = mobileMode === "calendar"
    ? grouped.filter((group) => group.date === selectedDay)
    : currentGrouped
  const currentPageIds = useMemo(() => currentGrouped.flatMap((g) => g.transactions.filter((t) => !isInitialBalanceTransaction(t.id)).map((t) => t.id)), [currentGrouped])
  // Delay incremental (acotado) para que las filas entren en cascada al
  // cambiar de mes/filtro/página, en vez de aparecer todas de golpe.
  const rowDelay = useMemo(() => new Map(currentPageIds.map((id, i) => [id, Math.min(i, 14) * 18])), [currentPageIds])

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full space-y-3 lg:w-auto lg:space-y-0">
          <CardTitle className="text-lg font-semibold">Transacciones</CardTitle>
          {selectedMonth && !cuentaId && (
            <div className="grid grid-cols-2 rounded-full bg-muted/70 p-1 md:hidden" role="group" aria-label="Vista de movimientos">
              <button type="button" aria-pressed={mobileView === "list"} onClick={() => setMobileView("list")} className={cn("flex min-h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all", mobileView === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}><List className="size-4" />Lista</button>
              <button type="button" aria-pressed={mobileView === "calendar"} onClick={() => setMobileView("calendar")} className={cn("flex min-h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all", mobileView === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}><CalendarDays className="size-4" />Calendario</button>
            </div>
          )}
          {selectedMonth && (
            <div className="flex w-full items-center justify-between gap-2 rounded-full border border-border bg-background/70 p-1 md:hidden">
              <button type="button" onClick={() => onMonthChange?.(1)} disabled={!onMonthChange} aria-label="Mes anterior" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"><ChevronLeft className="size-4" /></button>
              <span className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-foreground">{calendarMonthLabel}</span>
              {onToday && <button type="button" onClick={() => { onToday(); const today = localDateKey(); setSelectedCalendarDate({ month: today.slice(0, 7), day: today }) }} className="min-h-11 shrink-0 rounded-full px-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10">Hoy</button>}
              <button type="button" onClick={() => onMonthChange?.(-1)} disabled={!onMonthChange || selectedMonth >= localDateKey().slice(0, 7)} aria-label="Mes siguiente" className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"><ChevronRight className="size-4" /></button>
            </div>
          )}
          {selectedMonth && !cuentaId && mobileMode === "list" && <Button type="button" variant="outline" size="sm" className="h-11 w-full gap-2 md:hidden" onClick={() => setMobileFiltersOpen((open) => !open)} aria-expanded={mobileFiltersOpen}><SlidersHorizontal className="size-4" />{activeFiltersCount > 0 ? `Filtros activos · ${activeFiltersCount}` : "Filtros"}{activeFiltersCount > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{activeFiltersCount}</span>}</Button>}
        </div>
          <div className={cn("grid w-full grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-2", mobileMode === "calendar" || (selectedMonth && !cuentaId && mobileMode === "list" && !mobileFiltersOpen) ? "!hidden md:!flex" : "")}>
            <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-1.5 px-2.5 text-xs sm:h-9 sm:w-auto sm:px-3 sm:text-sm" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <label className="inline-flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border px-2 py-2 text-[11px] text-muted-foreground sm:px-2.5 sm:text-xs">
              <input type="checkbox" checked={showAdjustments} onChange={(e) => { setShowAdjustments(e.target.checked); setPage(0) }} />
              <span className="truncate">Ver ajustes de saldo</span>
            </label>
            <Filter className="hidden h-4 w-4 text-muted-foreground sm:block" />
            {!cuentaId && (
              <Select value={filterAccount} onValueChange={handleAccountFilter} items={{ all: "Todas las cuentas", ...Object.fromEntries(state.accounts.map((a) => [a.id, a.nombre])) }}>
                <SelectTrigger className="h-10 w-full min-w-0 text-xs sm:h-9 sm:w-40 sm:text-sm" aria-label="Filtrar por cuenta">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="p-2">
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {state.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={filterCategory} onValueChange={handleCategoryFilter} items={{ all: "Todas las categorías", ...Object.fromEntries(categoryFilterOptions.map((c) => [c.name, c.name])) }}>
              <SelectTrigger className="h-10 w-full min-w-0 text-xs sm:h-9 sm:w-40 sm:text-sm" aria-label="Filtrar por categoría">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent className="p-2">
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categoryFilterOptions.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="col-span-2 flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-card p-1 sm:col-span-1">
              {([
                { value: "all" as const, label: "Todos" },
                { value: "ingreso" as const, label: "Ingreso" },
                { value: "gasto" as const, label: "Gasto" },
                { value: "traspaso" as const, label: "Traspaso" },
              ]).map((tipo) => (
                <button
                  key={tipo.value}
                  onClick={() => handleTipoFilter(tipo.value)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-2 text-xs font-medium transition-colors sm:px-2.5 sm:py-1",
                    filterTipo === tipo.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tipo.label}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Limpiar filtros
              </Button>
            )}
            <div className="relative col-span-2 min-w-0 sm:col-span-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Buscar..."
              className="h-10 w-full rounded-xl pl-8 sm:h-9 sm:w-40 sm:pl-7"
            />
          </div>
          <label className="sr-only" htmlFor="transaction-sort">Ordenar movimientos</label>
          <select
            id="transaction-sort"
            value={sortOrder}
            onChange={(e) => { setSortOrder(e.target.value as "newest" | "oldest"); setPage(0) }}
            className="col-span-2 h-10 w-full min-w-0 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary sm:col-span-1 sm:h-9 sm:w-auto sm:min-w-36"
          >
            <option value="newest">Más recientes</option>
            <option value="oldest">Más antiguos</option>
          </select>
          <Button size="sm" className="hidden gap-1 sm:inline-flex" onClick={() => setShowNew(true)}>
            <Plus className="h-3.5 w-3.5" /> Nueva
          </Button>
          <Dialog open={showNew} onOpenChange={setShowNew}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva Transacción</DialogTitle>
              </DialogHeader>
              <TransactionForm
                accounts={state.accounts}
                categories={state.categories}
                onSave={(t) => { dispatch({ type: "ADD_TRANSACTION", payload: t }); setShowNew(false); toast("Transacción creada", "success") }}
                onCancel={() => setShowNew(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      {mobileMode === "calendar" && (
        <div className="space-y-3 px-3 pb-3 md:hidden">
          {mobileSummary && (
            <div className="grid grid-cols-3 gap-2">
              <div className="min-w-0 rounded-2xl border border-border/70 bg-background/50 px-2.5 py-3">
                <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Ingresos</p>
                <p className="mt-1 truncate text-xs font-bold tabular-nums text-emerald-500"><Sensitive>{formatMoney(mobileSummary.ingresos, "EUR")}</Sensitive></p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/70 bg-background/50 px-2.5 py-3">
                <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Gastos</p>
                <p className="mt-1 truncate text-xs font-bold tabular-nums text-red-400"><Sensitive>{formatMoney(mobileSummary.gastos, "EUR")}</Sensitive></p>
              </div>
              <div className="min-w-0 rounded-2xl border border-border/70 bg-background/50 px-2.5 py-3">
                <p className="truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Ahorro neto</p>
                <p className={cn("mt-1 truncate text-xs font-bold tabular-nums", mobileSummary.neto >= 0 ? "text-foreground" : "text-red-400")}><Sensitive>{formatMoney(mobileSummary.neto, "EUR")}</Sensitive></p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground" aria-label="Leyenda del calendario">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-emerald-500" />Ingresos</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-full bg-red-400" />Gastos</span>
            </div>
            <span className="hidden min-[380px]:inline">Color de fondo = saldo del día</span>
          </div>
          {hasActiveFilters && (
            <button type="button" onClick={() => { setMobileView("list"); setMobileFiltersOpen(true) }} className="w-full rounded-xl border border-primary/20 bg-primary/[0.06] px-3 py-2 text-left text-xs font-medium text-primary">
              {activeFiltersCount} filtro{activeFiltersCount === 1 ? " activo" : "s activos"} · Abrir lista para revisarlos
            </button>
          )}

          <div className="rounded-[22px] border border-border bg-background/50 p-2.5 sm:p-3">
            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
              {["L", "M", "X", "J", "V", "S", "D"].map((day, index) => <span key={`${day}-${index}`} className="py-1">{day}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: calendarCellCount }, (_, index) => {
                const day = index - leadingDays + 1
                if (day < 1 || day > daysInMonth) return <span key={`empty-${index}`} aria-hidden="true" />
                const dateKey = `${calendarMonth}-${String(day).padStart(2, "0")}`
                const stats = dailyTotals.get(dateKey)
                const net = (stats?.ingresos ?? 0) - (stats?.gastos ?? 0)
                const selected = selectedDay === dateKey
                const today = localDateKey() === dateKey
                const readableDate = new Date(calendarYear, calendarMonthNumber - 1, day).toLocaleDateString("es-ES", { day: "numeric", month: "long" })
                return (
                  <button
                    key={dateKey}
                    type="button"
                    aria-pressed={selected}
                    aria-label={`${readableDate}${stats ? `, ${stats.count} movimientos` : ", sin movimientos"}`}
                    onClick={() => setSelectedCalendarDate({ month: calendarMonth, day: dateKey })}
                    className={cn(
                      "flex min-h-[56px] min-w-0 flex-col items-center justify-between rounded-xl px-0.5 py-1.5 text-xs transition-colors active:scale-[0.97]",
                      selected ? "bg-primary text-primary-foreground shadow-sm" : net > 0 ? "bg-emerald-500/[0.11] text-foreground" : net < 0 ? "bg-red-500/[0.10] text-foreground" : "text-muted-foreground hover:bg-muted/70",
                      today && !selected && "ring-1 ring-[var(--gold)]/70"
                    )}
                  >
                    <span className={cn("font-semibold tabular-nums", selected && "text-primary-foreground")}>{day}</span>
                    {stats ? (
                      <span className="flex h-3.5 max-w-full items-center justify-center gap-0.5" aria-hidden="true">
                        {stats.ingresos > 0 && <span className={cn("size-1.5 rounded-full", selected ? "bg-primary-foreground" : "bg-emerald-500")} />}
                        {stats.gastos > 0 && <span className={cn("size-1.5 rounded-full", selected ? "bg-primary-foreground/65" : "bg-red-400")} />}
                        {stats.count > 0 && <span className={cn("ml-0.5 text-[9px] font-medium", selected ? "text-primary-foreground/80" : "text-muted-foreground")}>{stats.count > 1 ? `+${stats.count}` : "·"}</span>}
                      </span>
                    ) : <span className="h-3.5" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-y border-primary/20 bg-primary/5 px-4 py-2 animate-fade-in">
          <span className="text-xs font-semibold text-foreground">{selectedIds.size} seleccionada{selectedIds.size === 1 ? "" : "s"}</span>
          <Select value="" onValueChange={(v) => v && bulkRecategorize(v)}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label="Recategorizar seleccionadas">
              <SelectValue placeholder="Recategorizar…" />
            </SelectTrigger>
            <SelectContent className="p-2">
              {categoryFilterOptions.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="gap-1.5 text-red-500 hover:text-red-500" onClick={() => setBulkDeleteConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Eliminar
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>Cancelar</Button>
        </div>
      )}
      <CardContent className="p-0">
        <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <input
                  type="checkbox"
                  className="rounded border-muted-foreground"
                  aria-label="Seleccionar todas las transacciones visibles"
                  checked={currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id))}
                  onChange={(e) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) currentPageIds.forEach((id) => next.add(id))
                      else currentPageIds.forEach((id) => next.delete(id))
                      return next
                    })
                  }}
                />
              </TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="hidden md:table-cell">Cuenta</TableHead>
              <TableHead className="hidden sm:table-cell">Categoría</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="hidden lg:table-cell">Tags</TableHead>
              <TableHead className="w-12 sm:w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10">
                  <div className="space-y-3">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <div className="space-y-2">
                      <Skeleton className="h-10 rounded-xl" /><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-10 rounded-xl" />
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-10">
                  {hasActiveFilters ? (
                    <EmptyState
                      icon={Filter}
                      title="Ningún movimiento coincide con los filtros"
                      description="Prueba a cambiar la cuenta, categoría, tipo o el texto de búsqueda."
                      action={{ label: "Limpiar filtros", icon: X, onClick: clearFilters }}
                    />
                  ) : (
                    <EmptyState
                      icon={Search}
                      title="No hay transacciones este mes"
                      description="Registra tu primer movimiento para verlo aquí."
                      action={{ label: "Nueva transacción", icon: Plus, onClick: () => setShowNew(true) }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ) : (
              currentGrouped.map((group) => (
                <Fragment key={group.date}>
                  <TableRow>
                    {/* Mismo lenguaje que las etiquetas de sección de la app
                        (page-section-label): mayúsculas pequeñas espaciadas. */}
                    <TableCell colSpan={9} className="px-3 py-2 bg-card/90 backdrop-blur-sm text-[10px] sm:text-[11px] font-semibold uppercase text-muted-foreground tracking-[0.1em] border-b border-border/40">
                      {group.label}
                    </TableCell>
                  </TableRow>
                  {group.transactions.map((t) => {
                    const account = state.accounts.find((a) => a.id === t.cuenta_id)
                    const catHex = state.categories.find((c) => c.name === t.categoria)?.color
                    const chipStyle = categoryChipStyle(catHex)
                    const isEditing = (field: EditField) => editingCell?.id === t.id && editingCell.field === field
                    const categoryOptions = state.categories
                      .filter((c) => !c.kind || c.kind === t.tipo || c.kind === "both")
                      .sort((a, b) => a.name.localeCompare(b.name, "es"))
                      .map((c) => ({ value: c.name, label: c.name }))
                    const transfer = isTransfer(t)
                    const recurring = isRecurringTransaction(t)
                    const isSystemTag = (tag: string) => tag === "traspaso" || tag === "recurrente" || tag.startsWith("recurrente:")
                    const systemAdjustment = isInitialBalanceTransaction(t.id)
                    return (
                      <TableRow
                        key={t.id}
                        className={cn("group stagger-fade-fast transition-colors hover:bg-muted/40", transfer && "bg-violet-500/[0.03]", selectedIds.has(t.id) && "bg-primary/[0.05]")}
                        style={{ animationDelay: `${rowDelay.get(t.id) ?? 0}ms` }}
                      >
                        <TableCell>
                          {/* Atenuado en reposo para no llenar la tabla de
                              cuadraditos; recupera presencia al pasar por la
                              fila, al marcarlo o al enfocarlo con teclado. */}
                          <input
                            type="checkbox"
                            className="rounded border-muted-foreground opacity-30 transition-opacity group-hover:opacity-100 checked:opacity-100 focus-visible:opacity-100"
                            aria-label="Seleccionar transacción"
                            checked={selectedIds.has(t.id)}
                            disabled={systemAdjustment}
                            title={systemAdjustment ? "Los ajustes de saldo son de solo lectura" : undefined}
                            onChange={() => toggleSelected(t.id)}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                          {isEditing("fecha") ? (
                            <InlineEditInput type="date" defaultValue={t.fecha} onDone={(ok, v) => handleInlineDone(t, "fecha", ok, v)} />
                          ) : (
                            <button disabled={systemAdjustment} title={systemAdjustment ? "Ajuste de saldo de solo lectura" : undefined} onClick={() => setEditingCell({ id: t.id, field: "fecha" })} className="cursor-text rounded px-1 py-0.5 -mx-1 hover:bg-muted/60" aria-label="Editar fecha">
                              {parseLocalDate(t.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[100px] sm:max-w-[140px]">
                          {isEditing("descripcion") ? (
                            <InlineEditInput defaultValue={t.descripcion} onDone={(ok, v) => handleInlineDone(t, "descripcion", ok, v)} />
                          ) : (
                            <button disabled={systemAdjustment} title={systemAdjustment ? "Ajuste de saldo de solo lectura" : undefined} onClick={() => setEditingCell({ id: t.id, field: "descripcion" })} className="flex w-full items-center gap-2 rounded px-1 py-0.5 -mx-1 text-left hover:bg-muted/60" aria-label="Editar descripción">
                              <span className="inline-flex h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: catHex ?? "var(--muted-foreground)" }} />
                              <span className="truncate font-medium">{t.descripcion || t.categoria}</span>
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell"><span className="text-xs text-muted-foreground">{account?.nombre}</span></TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {isEditing("categoria") ? (
                            <InlineEditSelect defaultValue={t.categoria} options={categoryOptions} onDone={(ok, v) => handleInlineDone(t, "categoria", ok, v)} />
                          ) : (
                            <button
                              disabled={systemAdjustment} title={systemAdjustment ? "Ajuste de saldo de solo lectura" : undefined} onClick={() => setEditingCell({ id: t.id, field: "categoria" })}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium",
                                !chipStyle && "bg-muted/60 text-muted-foreground ring-1 ring-inset ring-border/20"
                              )}
                              style={chipStyle}
                              aria-label="Editar categoría"
                            >
                              {t.categoria}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {isInitialBalanceTransaction(t.id) ? (
                            /* Saldo inicial / ajuste de saldo: no es un ingreso ni un
                               gasto real, y su delta puede tener cualquier signo — el
                               chip "Ingreso" junto a un importe negativo confunde. */
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                              Ajuste
                            </span>
                          ) : transfer ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/8 px-2 py-0.5 text-[11px] font-semibold text-violet-500">
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                              Traspaso
                            </span>
                          ) : (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            t.tipo === "ingreso"
                              ? "bg-emerald-500/8 text-emerald-500"
                              : "bg-red-500/8 text-red-500"
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${t.tipo === "ingreso" ? "bg-emerald-500" : "bg-red-500"}`} />
                            {t.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                          </span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-bold text-xs sm:text-sm ${(t.tipo === "ingreso" ? t.monto : -t.monto) >= 0 ? "text-emerald-500" : "text-foreground"}`}>
                          <div className="flex items-center justify-end gap-1.5">
                            {transfer && <ArrowLeftRight className="h-3 w-3 shrink-0 text-violet-500" aria-label="Traspaso" />}
                            {recurring && <Repeat className="h-3 w-3 shrink-0 text-[var(--gold)]" aria-label="Recurrente" />}
                            {isEditing("monto") ? (
                              <InlineEditInput type="number" defaultValue={String(t.monto)} onDone={(ok, v) => handleInlineDone(t, "monto", ok, v)} />
                            ) : (
                              <button disabled={systemAdjustment} title={systemAdjustment ? "Ajuste de saldo de solo lectura" : undefined} onClick={() => setEditingCell({ id: t.id, field: "monto" })} className="rounded px-1 py-0.5 -mx-1 hover:bg-muted/60" aria-label="Editar monto">
                                <Sensitive>{(t.tipo === "ingreso" ? t.monto : -t.monto) >= 0 ? "+" : "-"}{formatMoney(Math.abs(t.monto), account?.currency ?? "EUR")}</Sensitive>
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex gap-1">
                            {t.tags.slice(0, 2).map((tag) => (
                              <span key={tag} className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", isSystemTag(tag) ? "gold-badge" : "bg-muted/60 text-muted-foreground ring-1 ring-border/20")}>{tag}</span>
                            ))}
                            {t.tags.length > 2 && (
                              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/20">+{t.tags.length - 2}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button disabled={systemAdjustment} title={systemAdjustment ? "Ajuste de saldo de solo lectura" : undefined} onClick={() => setEditingTxn(t)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90" aria-label="Editar transacción">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button disabled={systemAdjustment} title={systemAdjustment ? "Ajuste de saldo de solo lectura" : undefined} onClick={() => setDeleteConfirm(t)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-90" aria-label="Eliminar transacción">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </Fragment>
              ))
            )}
          </TableBody>
        </Table>
        </div>
        <div className={cn("space-y-3 px-3 pb-3 md:hidden", mobileMode === "calendar" && "hidden")}>
          {loading ? (
            <div className="space-y-3 py-3" aria-label="Cargando movimientos">
              <Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-24 rounded-2xl" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="py-8">
              {hasActiveFilters ? (
                <EmptyState icon={Filter} title="Ningún movimiento coincide" description="Cambia o limpia los filtros para ver otros movimientos." action={{ label: "Limpiar filtros", icon: X, onClick: clearFilters }} />
              ) : (
                <EmptyState icon={Search} title="Sin movimientos este mes" description="Registra tu primer movimiento para verlo aquí." action={{ label: "Nueva transacción", icon: Plus, onClick: () => setShowNew(true) }} />
              )}
            </div>
          ) : mobileGroups.map((group) => (
            <section key={group.date} aria-label={group.label}>
              {mobileMode === "list" && <h3 className="px-1 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{group.label}</h3>}
              <div className="space-y-2">
                {group.transactions.map((t) => {
                  const account = state.accounts.find((a) => a.id === t.cuenta_id)
                  const category = state.categories.find((c) => c.name === t.categoria)
                  const transfer = isTransfer(t)
                  const systemAdjustment = isInitialBalanceTransaction(t.id)
                  const positive = t.tipo === "ingreso" && !transfer
                  return (
                    <article key={t.id} className={cn("rounded-2xl border border-border bg-card p-3.5 shadow-sm", transfer && "border-violet-500/20 bg-violet-500/[0.025]", selectedIds.has(t.id) && "ring-1 ring-primary/30")}>
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 rounded border-muted-foreground"
                          aria-label={`Seleccionar ${t.descripcion || t.categoria}`}
                          checked={selectedIds.has(t.id)}
                          disabled={systemAdjustment}
                          onChange={() => toggleSelected(t.id)}
                        />
                        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color ?? "var(--muted-foreground)" }} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">{t.descripcion || t.categoria}</p>
                            <span className={cn("shrink-0 text-sm font-bold tabular-nums", positive ? "text-emerald-500" : transfer ? "text-violet-500" : "text-foreground")}>
                              <Sensitive>{positive ? "+" : transfer ? "" : "−"}{formatMoney(t.monto, account?.currency ?? "EUR")}</Sensitive>
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span>{t.categoria}</span><span aria-hidden="true">·</span><span className="max-w-full truncate">{account?.nombre ?? "Cuenta eliminada"}</span>
                            {mobileMode === "list" && <><span aria-hidden="true">·</span><span className="tabular-nums">{dateLabel(t.fecha)}</span></>}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", transfer ? "bg-violet-500/10 text-violet-500" : positive ? "bg-emerald-500/10 text-emerald-500" : systemAdjustment ? "bg-muted text-muted-foreground" : "bg-red-500/10 text-red-500")}>
                              {systemAdjustment ? "Ajuste" : transfer ? "Traspaso" : positive ? "Ingreso" : "Gasto"}
                            </span>
                              <div className="flex items-center gap-1">
                                {!transfer && !systemAdjustment && <button type="button" onClick={() => duplicateTransaction(t)} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" aria-label={`Duplicar ${t.descripcion || t.categoria} para hoy`} title="Duplicar para hoy"><Copy className="size-4" /><span className="sr-only">Duplicar para hoy</span></button>}
                                <button type="button" disabled={systemAdjustment} onClick={() => setEditingTxn(t)} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label={`Editar ${t.descripcion || t.categoria}`} title="Editar">
                                <Pencil className="size-4" /><span className="sr-only">Editar</span>
                              </button>
                              <button type="button" disabled={systemAdjustment} onClick={() => setDeleteConfirm(t)} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40" aria-label={`Eliminar ${t.descripcion || t.categoria}`} title="Eliminar">
                                <Trash2 className="size-4" /><span className="sr-only">Eliminar</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
        {mobileMode === "calendar" && (
          <div className="space-y-3 px-3 pb-4 md:hidden">
            <div className="flex items-end justify-between gap-3 px-1 pt-1">
              <h3 className="min-w-0 truncate text-base font-bold capitalize text-foreground">{selectedDayLabel}</h3>
              <span className={cn("flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums", selectedDayNet >= 0 ? "text-emerald-500" : "text-red-400")}>
                {selectedDayNet > 0 ? <TrendingUp className="size-3.5" /> : selectedDayNet < 0 ? <TrendingDown className="size-3.5" /> : null}
                <Sensitive>
                {selectedDayNet > 0 ? "+" : ""}{formatMoney(selectedDayNet, "EUR")}
                </Sensitive>
              </span>
            </div>
            {loading ? (
              <div className="space-y-2" aria-label="Cargando movimientos"><Skeleton className="h-20 rounded-2xl" /><Skeleton className="h-20 rounded-2xl" /></div>
            ) : selectedDayTransactions.length === 0 && sorted.length > 0 ? (
              <div className="rounded-2xl border border-dashed border-border px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">Día tranquilo</p>
                <p className="mt-1 text-xs text-muted-foreground">No hay movimientos este día. Elige otra fecha del calendario.</p>
              </div>
            ) : sorted.length === 0 ? (
              <div className="py-4">
                {hasActiveFilters ? (
                  <EmptyState icon={Filter} title="Ningún movimiento coincide" description="Cambia o limpia los filtros para ver otros movimientos." action={{ label: "Limpiar filtros", icon: X, onClick: clearFilters }} />
                ) : (
                  <EmptyState icon={Search} title="Sin movimientos este mes" description="Registra tu primer movimiento para verlo aquí." action={{ label: "Nueva transacción", icon: Plus, onClick: () => setShowNew(true) }} />
                )}
              </div>
            ) : mobileGroups.map((group) => (
              <section key={group.date} aria-label={group.label}>
                <div className="space-y-2">
                  {group.transactions.map((t) => {
                    const account = state.accounts.find((a) => a.id === t.cuenta_id)
                    const category = state.categories.find((c) => c.name === t.categoria)
                    const transfer = isTransfer(t)
                    const systemAdjustment = isInitialBalanceTransaction(t.id)
                    const positive = t.tipo === "ingreso" && !transfer
                    return (
                      <article key={t.id} className={cn("rounded-2xl border border-border bg-card p-3.5 shadow-sm", transfer && "border-violet-500/20 bg-violet-500/[0.025]", selectedIds.has(t.id) && "ring-1 ring-primary/30")}>
                        <div className="flex items-start gap-3">
                          <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category?.color ?? "var(--muted-foreground)" }} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground">{t.descripcion || t.categoria}</p>
                              <span className={cn("shrink-0 text-sm font-bold tabular-nums", positive ? "text-emerald-500" : transfer ? "text-violet-500" : "text-foreground")}><Sensitive>{positive ? "+" : transfer ? "" : "−"}{formatMoney(t.monto, account?.currency ?? "EUR")}</Sensitive></span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span>{t.categoria}</span><span aria-hidden="true">·</span><span className="max-w-full truncate">{account?.nombre ?? "Cuenta eliminada"}</span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", transfer ? "bg-violet-500/10 text-violet-500" : positive ? "bg-emerald-500/10 text-emerald-500" : systemAdjustment ? "bg-muted text-muted-foreground" : "bg-red-500/10 text-red-500")}>{systemAdjustment ? "Ajuste" : transfer ? "Traspaso" : positive ? "Ingreso" : "Gasto"}</span>
                              <div className="flex items-center gap-1">
                                {!transfer && !systemAdjustment && <button type="button" onClick={() => duplicateTransaction(t)} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary" aria-label={`Duplicar ${t.descripcion || t.categoria} para hoy`} title="Duplicar para hoy"><Copy className="size-4" /><span className="sr-only">Duplicar para hoy</span></button>}
                                <button type="button" disabled={systemAdjustment} onClick={() => setEditingTxn(t)} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40" aria-label={`Editar ${t.descripcion || t.categoria}`} title="Editar"><Pencil className="size-4" /><span className="sr-only">Editar</span></button>
                                <button type="button" disabled={systemAdjustment} onClick={() => setDeleteConfirm(t)} className="inline-flex size-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500 disabled:opacity-40" aria-label={`Eliminar ${t.descripcion || t.categoria}`} title="Eliminar"><Trash2 className="size-4" /><span className="sr-only">Eliminar</span></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
        {mobileMode === "list" && totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Página {safePage + 1} de {totalPages} · {sorted.length} transacciones
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none active:scale-95"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const start = Math.max(0, Math.min(safePage - 2, totalPages - 5))
                const p = start + i
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all active:scale-95 ${
                      p === safePage
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {p + 1}
                  </button>
                )
              })}
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= totalPages - 1}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none active:scale-95"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </CardContent>

      <Dialog open={editingTxn !== null} onOpenChange={(open) => { if (!open) setEditingTxn(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Transacción</DialogTitle>
          </DialogHeader>
          {editingTxn && (
            <TransactionForm
              transaction={editingTxn}
              accounts={state.accounts}
              categories={state.categories}
              onSave={(tx) => { dispatch({ type: "UPDATE_TRANSACTION", payload: tx }); setEditingTxn(null); toast("Transacción actualizada", "success") }}
              onCancel={() => setEditingTxn(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => {
          if (!deleteConfirm) return
          dispatch({ type: "DELETE_TRANSACTION", payload: deleteConfirm.id })
          // Borrado explícito e inmediato (no solo vía el borrado-espejo de
          // syncToSupabase): las transacciones con tag "atajo" quedan
          // excluidas de ese borrado-espejo (ver deleteRemoteMissingRows en
          // store.tsx) para que /api/shortcuts/movement no las pierda por una
          // sincronización con estado local desactualizado; sin esta llamada
          // directa, esas transacciones nunca se borrarían de Supabase.
          dbDeleteEq("transactions", "id", deleteConfirm.id).then(() => {}, () => {})
          toast("Transacción eliminada", "success")
        }}
        title="¿Eliminar transacción?"
        description={<>Se eliminará la transacción &ldquo;{deleteConfirm?.descripcion || deleteConfirm?.categoria || ""}&rdquo; de <Sensitive>{deleteConfirm?.monto?.toLocaleString("es-ES")} €</Sensitive>. No se puede deshacer.</>}
        confirmLabel="Eliminar"
        destructive
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        onOpenChange={setBulkDeleteConfirm}
        onConfirm={bulkDelete}
        title="¿Eliminar transacciones seleccionadas?"
        description={<>Se eliminarán <strong>{selectedIds.size}</strong> transacciones. No se puede deshacer.</>}
        confirmLabel="Eliminar"
        destructive
      />
    </Card>
  )
}
