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
import { Filter, Plus, Pencil, Trash2, Search, Download, AlertCircle, X, ArrowLeftRight, Repeat } from "lucide-react"
import { parseAmount } from "@/lib/validation"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatMoney } from "@/lib/currency"
import { dateLabel, isInitialBalanceTransaction } from "@/lib/format"
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

function TransactionForm({
  transaction,
  accounts,
  categories,
  onSave,
  onCancel,
}: {
  transaction?: Transaction
  accounts: { id: string; nombre: string }[]
  categories: Category[]
  onSave: (t: Transaction) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split("T")[0]
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
          <label className="text-xs text-muted-foreground">Cuenta</label>
          <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => changeTipo(v as "ingreso" | "gasto")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ingreso">Ingreso</SelectItem>
              <SelectItem value="gasto">Gasto</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Monto (€)</label>
          <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Categoría</label>
          <Select value={categoria} onValueChange={(v) => v && setCategoria(v)}>
            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Descripción</label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={esNecesidad}
            onChange={(e) => setEsNecesidad(e.target.checked)}
            className="rounded border-muted-foreground"
          />
          <span className="text-sm text-muted-foreground">Es necesidad</span>
        </label>
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
        <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm">{transaction ? "Guardar" : "Crear"}</Button>
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

export function TransactionsTable({ cuentaId, selectedMonth }: { cuentaId?: string; selectedMonth?: string }) {
  const { state, loading, dispatch } = useFinance()
  const { toast } = useToast()
  const searchParams = useSearchParams()
  const [filterAccount, setFilterAccount] = useState<string>(cuentaId ?? "all")
  const [filterCategory, setFilterCategory] = useState<string>("all")
  // Permite llegar aquí desde otra página con el tipo ya filtrado, ej. al
  // pinchar el ticker "Ingresos"/"Gastos" del Dashboard (/transactions?tipo=...).
  const [filterTipo, setFilterTipo] = useState<"all" | "ingreso" | "gasto">(() => {
    const tipo = searchParams.get("tipo")
    return tipo === "ingreso" || tipo === "gasto" ? tipo : "all"
  })
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [editingCell, setEditingCell] = useState<{ id: string; field: EditField } | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
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
    for (const id of selectedIds) {
      dispatch({ type: "DELETE_TRANSACTION", payload: id })
      dbDeleteEq("transactions", "id", id).then(() => {}, () => {})
    }
    toast(`${selectedIds.size} transacciones eliminadas`, "success")
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

  const handleAccountFilter = (value: string | null) => {
    if (value) { setFilterAccount(value); setPage(0) }
  }
  const handleCategoryFilter = (value: string | null) => {
    if (value) { setFilterCategory(value); setPage(0) }
  }
  const handleTipoFilter = (value: "all" | "ingreso" | "gasto") => {
    setFilterTipo(value); setPage(0)
  }
  const hasActiveFilters = filterAccount !== "all" || filterCategory !== "all" || filterTipo !== "all" || search !== ""
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
        .filter((t) => filterAccount === "all" || t.cuenta_id === filterAccount)
        .filter((t) => filterCategory === "all" || t.categoria === filterCategory)
        .filter((t) => filterTipo === "all" || t.tipo === filterTipo)
        .filter((t) => !search || t.descripcion.toLowerCase().includes(search.toLowerCase()) || t.categoria.toLowerCase().includes(search.toLowerCase()) || t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) =>
          safeTime(b.fecha) - safeTime(a.fecha)
          || safeTime(b.created_at ?? "") - safeTime(a.created_at ?? "")
          || (orderIndex.get(b.id) ?? 0) - (orderIndex.get(a.id) ?? 0)
        )
    },
    [state.transactions, filterAccount, filterCategory, filterTipo, search, selectedMonth]
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

  const categoryFilterOptions = useMemo(
    () => [...state.categories].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [state.categories]
  )

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const currentGrouped = useMemo(() => grouped.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE), [grouped, safePage])
  const currentPageIds = useMemo(() => currentGrouped.flatMap((g) => g.transactions.map((t) => t.id)), [currentGrouped])
  // Delay incremental (acotado) para que las filas entren en cascada al
  // cambiar de mes/filtro/página, en vez de aparecer todas de golpe.
  const rowDelay = useMemo(() => new Map(currentPageIds.map((id, i) => [id, Math.min(i, 14) * 18])), [currentPageIds])

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-lg font-semibold">Transacciones</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            <Filter className="h-4 w-4 text-muted-foreground" />
            {!cuentaId && (
              <Select value={filterAccount} onValueChange={handleAccountFilter} items={{ all: "Todas las cuentas", ...Object.fromEntries(state.accounts.map((a) => [a.id, a.nombre])) }}>
                <SelectTrigger className="w-40" aria-label="Filtrar por cuenta">
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
              <SelectTrigger className="w-40" aria-label="Filtrar por categoría">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent className="p-2">
                <SelectItem value="all">Todas las categorías</SelectItem>
                {categoryFilterOptions.map((c) => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
              {(["all", "ingreso", "gasto"] as const).map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => handleTipoFilter(tipo)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    filterTipo === tipo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tipo === "all" ? "Todos" : tipo === "ingreso" ? "Ingreso" : "Gasto"}
                </button>
              ))}
            </div>
            {hasActiveFilters && (
              <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={clearFilters}>
                <X className="h-3.5 w-3.5" /> Limpiar filtros
              </Button>
            )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0) }}
              placeholder="Buscar..."
              className="h-9 w-40 rounded-xl pl-7"
            />
          </div>
          <Button size="sm" className="gap-1" onClick={() => setShowNew(true)}>
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
                    <TableCell colSpan={9} className="px-3 py-2 bg-card/90 backdrop-blur-sm text-[11px] sm:text-xs font-bold text-muted-foreground tracking-[0.08em] border-b border-border/40">
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
                            onChange={() => toggleSelected(t.id)}
                          />
                        </TableCell>
                        <TableCell className="tabular-nums text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                          {isEditing("fecha") ? (
                            <InlineEditInput type="date" defaultValue={t.fecha} onDone={(ok, v) => handleInlineDone(t, "fecha", ok, v)} />
                          ) : (
                            <button onClick={() => setEditingCell({ id: t.id, field: "fecha" })} className="cursor-text rounded px-1 py-0.5 -mx-1 hover:bg-muted/60" aria-label="Editar fecha">
                              {new Date(t.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[100px] sm:max-w-[140px]">
                          {isEditing("descripcion") ? (
                            <InlineEditInput defaultValue={t.descripcion} onDone={(ok, v) => handleInlineDone(t, "descripcion", ok, v)} />
                          ) : (
                            <button onClick={() => setEditingCell({ id: t.id, field: "descripcion" })} className="flex w-full items-center gap-2 rounded px-1 py-0.5 -mx-1 text-left hover:bg-muted/60" aria-label="Editar descripción">
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
                              onClick={() => setEditingCell({ id: t.id, field: "categoria" })}
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
                              <button onClick={() => setEditingCell({ id: t.id, field: "monto" })} className="rounded px-1 py-0.5 -mx-1 hover:bg-muted/60" aria-label="Editar monto">
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
                            <button onClick={() => setEditingTxn(t)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90" aria-label="Editar transacción">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setDeleteConfirm(t)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-all active:scale-90" aria-label="Eliminar transacción">
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
        {totalPages > 1 && (
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
