"use client"

import { useState, useMemo } from "react"
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
      <div className="grid grid-cols-2 gap-3">
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
  const [editingTxn, setEditingTxn] = useState<Transaction | null>(null)
  const [showNew, setShowNew] = useState(false)

  const handleAccountFilter = (value: string | null) => {
    if (value) setFilterAccount(value)
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
    a.download = `movimientos_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast("CSV exportado", "success")
  }

  const sorted = useMemo(
    () =>
      filterTransactionsByMonth(state.transactions, selectedMonth)
        .filter((t) => filterAccount === "all" || t.cuenta_id === filterAccount)
        .filter((t) => !search || t.descripcion.toLowerCase().includes(search.toLowerCase()) || t.categoria.toLowerCase().includes(search.toLowerCase()) || t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()),
    [state.transactions, filterAccount, search, selectedMonth]
  )

  return (
    <Card className="col-span-full border-border/60 bg-card/95 shadow-sm">
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
                <SelectTrigger className="w-48">
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
              onChange={(e) => setSearch(e.target.value)}
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
              <TableHead>Cuenta</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="w-16" />
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
              sorted.map((t) => {
                const account = state.accounts.find((a) => a.id === t.cuenta_id)
                return (
                  <TableRow key={t.id} className="group">
                    <TableCell className="tabular-nums text-sm">
                      {new Date(t.fecha).toLocaleDateString("es-ES", {
                        day: "2-digit", month: "short",
                      })}
                    </TableCell>
                    <TableCell className="text-sm max-w-[140px] truncate">{t.descripcion || "—"}</TableCell>
                    <TableCell><span className="text-xs text-muted-foreground">{account?.nombre}</span></TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`font-medium ${CATEGORY_COLORS[t.categoria] || ""}`}>
                        {t.categoria}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-sm font-medium ${t.tipo === "ingreso" ? "text-emerald-500" : "text-red-500"}`}>
                        {t.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${t.tipo === "ingreso" ? "text-emerald-500" : ""}`}>
                      {t.tipo === "ingreso" ? "+" : "-"}{formatMoney(t.monto, account?.currency ?? "EUR")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {t.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">{tag}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingTxn(t)}>
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                        </button>
                        <button onClick={() => { dispatch({ type: "DELETE_TRANSACTION", payload: t.id }); toast("Transacción eliminada", "success") }}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
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
    </Card>
  )
}
