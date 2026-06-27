"use client"

import { useState, useMemo, Fragment } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
import { useFinance, type Transaction, generateId } from "@/lib/store"
import { Filter, Plus, Pencil, Trash2, Search, Download } from "lucide-react"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatMoney } from "@/lib/currency"
import { filterTransactionsByMonth } from "@/lib/calculations"

const CATEGORY_COLORS: Record<string, string> = {
  Salario: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  Alquiler: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Supermercado: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  Transporte: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Internet: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
  Cena: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  Suscripciones: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  Ropa: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  Transferencia: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  Ocio: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  Gym: "bg-lime-500/10 text-lime-600 dark:text-lime-400",
  Salud: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
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
  categories: string[]
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cuentaId || !monto || !fecha || !categoria) return
    onSave({
      id: transaction?.id ?? generateId(),
      cuenta_id: cuentaId,
      monto: Number(monto),
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
          <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)}>
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
          <Select value={tipo} onValueChange={(v) => setTipo(v as "ingreso" | "gasto")}>
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
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Descripción</label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Opcional" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={esNecesidad}
            onChange={(e) => setEsNecesidad(e.target.checked)}
            className="rounded border-muted-foreground"
          />
          <span className="text-sm text-muted-foreground">Es necesidad</span>
        </label>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Tags</label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
            placeholder="Ej: recurrente"
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

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm">{transaction ? "Guardar" : "Crear"}</Button>
      </div>
    </form>
  )
}

export function TransactionsTable({ cuentaId, selectedMonth }: { cuentaId?: string; selectedMonth?: string }) {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [filterAccount, setFilterAccount] = useState<string>(cuentaId ?? "all")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Transaction | null>(null)
  const PAGE_SIZE = 25

  const handleAccountFilter = (value: string | null) => {
    if (value) { setFilterAccount(value); setPage(0) }
  }

  const exportCSV = () => {
    const headers = ["fecha", "tipo", "categoria", "descripcion", "monto", "cuenta", "divisa", "tags"]
    const rows = state.transactions.map((t) => {
      const account = state.accounts.find((a) => a.id === t.cuenta_id)
      const values = [
        t.fecha,
        t.tipo,
        t.categoria,
        `"${t.descripcion.replaceAll('"', '""')}"`,
        t.monto,
        account?.nombre ?? "",
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

  const dateLabel = (dateStr: string) => {
    const d = new Date(dateStr)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    if (d.toDateString() === today.toDateString()) return "Hoy"
    if (d.toDateString() === yesterday.toDateString()) return "Ayer"
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
  }

  const sorted = useMemo(
    () => {
      const safeTime = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime() }
      return filterTransactionsByMonth(state.transactions, selectedMonth)
        .filter((t) => !t.id.startsWith("init_"))
        .filter((t) => filterAccount === "all" || t.cuenta_id === filterAccount)
        .filter((t) => !search || t.descripcion.toLowerCase().includes(search.toLowerCase()) || t.categoria.toLowerCase().includes(search.toLowerCase()) || t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => safeTime(b.fecha) - safeTime(a.fecha))
    },
    [state.transactions, filterAccount, search, selectedMonth]
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

  const totalPages = Math.max(1, Math.ceil(grouped.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const currentGrouped = useMemo(() => grouped.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE), [grouped, safePage])

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-lg font-semibold">Transacciones</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Exportar CSV
            </Button>
            {!cuentaId && (
              <>
                <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterAccount} onValueChange={handleAccountFilter}>
                <SelectTrigger className="w-48" aria-label="Filtrar por cuenta">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="p-2">
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {state.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
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
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
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
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  <div className="flex flex-col items-center gap-2">
                    <Search className="h-6 w-6 text-muted-foreground/40" />
                    <span className="text-sm text-muted-foreground">No hay transacciones aquí</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              currentGrouped.map((group) => (
                <Fragment key={group.date}>
                  <TableRow className="sticky top-10 z-10">
                    <TableCell colSpan={8} className="px-2 py-1.5 bg-background/80 backdrop-blur-sm text-[11px] sm:text-xs font-semibold text-muted-foreground capitalize tracking-wide">
                      {group.label}
                    </TableCell>
                  </TableRow>
                  {group.transactions.map((t) => {
                    const account = state.accounts.find((a) => a.id === t.cuenta_id)
                    return (
                      <TableRow key={t.id} className="group">
                        <TableCell className="tabular-nums text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                          {new Date(t.fecha).toLocaleDateString("es-ES", {
                            day: "2-digit", month: "short",
                          })}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm max-w-[100px] sm:max-w-[140px] truncate">{t.descripcion || "—"}</TableCell>
                        <TableCell className="hidden md:table-cell"><span className="text-xs text-muted-foreground">{account?.nombre}</span></TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary" className={`font-medium text-[10px] sm:text-xs ${CATEGORY_COLORS[t.categoria] || ""}`}>
                            {t.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className={`text-xs sm:text-sm font-medium ${t.tipo === "ingreso" ? "text-emerald-500" : "text-red-500"}`}>
                            {t.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                          </span>
                        </TableCell>
                        <TableCell className={`text-right tabular-nums font-medium text-xs sm:text-sm ${t.tipo === "ingreso" ? "text-emerald-500" : ""}`}>
                          {t.tipo === "ingreso" ? "+" : "-"}{formatMoney(t.monto, account?.currency ?? "EUR")}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="flex gap-1">
                            {t.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                            ))}
                            {t.tags.length > 2 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{t.tags.length - 2}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setEditingTxn(t)} className="touch-manipulation" aria-label="Editar transacción">
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                            <button onClick={() => setDeleteConfirm(t)} className="touch-manipulation" aria-label="Eliminar transacción">
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
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
        onConfirm={() => { if (deleteConfirm) { dispatch({ type: "DELETE_TRANSACTION", payload: deleteConfirm.id }); toast("Transacción eliminada", "success") }}}
        title="¿Eliminar transacción?"
        description={`Se eliminará la transacción "${deleteConfirm?.descripcion || deleteConfirm?.categoria || ""}" de ${deleteConfirm?.monto?.toLocaleString("es-ES")}€. No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
      />
    </Card>
  )
}
