"use client"

import { useState } from "react"
import { Plus, ArrowRightLeft, ArrowDownCircle, ArrowUpCircle, Send } from "lucide-react"
import { useToast } from "@/components/ui/toast"
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
import { useFinance, type Transaction, type Account, generateId } from "@/lib/store"

const typeBadge: Record<string, { label: string; color: string }> = {
  emergencia: { label: "Emergencia", color: "text-emerald-500" },
  ahorro: { label: "Ahorro", color: "text-blue-500" },
  inversion: { label: "Inversión", color: "text-violet-500" },
  efectivo: { label: "Efectivo", color: "text-amber-500" },
  gastos: { label: "Gastos", color: "text-red-500" },
}

function AccountSelectItem({ account, showBalance = true }: { account: Account; showBalance?: boolean }) {
  const badge = typeBadge[account.tipo]
  return (
    <div className="flex w-full items-center gap-3">
      <div
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-white shadow-sm"
        style={{ backgroundColor: account.color }}
      >
        {account.nombre.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[15px] font-semibold leading-tight">{account.nombre}</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${badge?.color ?? "bg-muted text-muted-foreground"}`}>
            {badge?.label}
          </span>
        </div>
        <p className="truncate text-xs leading-tight text-muted-foreground">
          {account.banco || "Sin banco"}
        </p>
      </div>
      {showBalance && (
        <span className="text-sm font-semibold tabular-nums whitespace-nowrap text-foreground/90">
          {account.saldo.toLocaleString("es-ES")}€
        </span>
      )}
    </div>
  )
}

function TransactionQuickForm({
  defaultTipo,
  accounts,
  categories,
  onSave,
  onCancel,
}: {
  defaultTipo: "ingreso" | "gasto"
  accounts: Account[]
  categories: string[]
  onSave: (t: Transaction) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split("T")[0]
  const gastosAccounts = accounts.filter((a) => a.tipo === "gastos" || a.tipo === "efectivo")
  const defaultAccount = defaultTipo === "gasto"
    ? (gastosAccounts[0]?.id ?? accounts[0]?.id ?? "")
    : (accounts.find((a) => a.tipo === "efectivo" || a.tipo === "ahorro")?.id ?? accounts[0]?.id ?? "")

  const [cuentaId, setCuentaId] = useState(defaultAccount)
  const [monto, setMonto] = useState("")
  const [fecha, setFecha] = useState(today)
  const [categoria, setCategoria] = useState("")
  const [esNecesidad, setEsNecesidad] = useState(defaultTipo === "gasto")
  const [descripcion, setDescripcion] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cuentaId || !monto || !categoria) return
    onSave({
      id: generateId(),
      cuenta_id: cuentaId,
      monto: Number(monto),
      fecha,
      tipo: defaultTipo,
      categoria,
      es_necesidad: esNecesidad,
      descripcion,
      tags: [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Cuenta</label>
        <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)}>
          <SelectTrigger className="h-12 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[28rem] max-w-[calc(100vw-2rem)] p-2">
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id} className="py-0">
                <AccountSelectItem account={a} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Monto (€)</label>
          <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" required autoFocus className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12 text-base" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Categoría</label>
        <Select value={categoria} onValueChange={(v) => v && setCategoria(v)}>
          <SelectTrigger className="h-12 w-full text-sm">
            <SelectValue placeholder="Seleccionar categoría" />
          </SelectTrigger>
          <SelectContent className="p-2">
            {categories.map((c) => (
              <SelectItem key={c} value={c} className="py-2.5 text-sm">{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Descripción</label>
        <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Nómina junio" className="h-12 text-base" />
      </div>

      <label className="flex items-center gap-3 cursor-pointer py-1">
        <input
          type="checkbox"
          checked={esNecesidad}
          onChange={(e) => setEsNecesidad(e.target.checked)}
          className="h-4 w-4 rounded border-muted-foreground"
        />
        <span className="text-sm text-foreground">Es necesidad</span>
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="h-11 px-6">
          {defaultTipo === "gasto" ? "Registrar Gasto" : "Registrar Ingreso"}
        </Button>
      </div>
    </form>
  )
}

function TransferForm({
  accounts,
  onSave,
  onCancel,
}: {
  accounts: Account[]
  onSave: (sourceId: string, destId: string, monto: number, descripcion: string) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split("T")[0]
  const [origenId, setOrigenId] = useState(accounts[0]?.id ?? "")
  const [destinoId, setDestinoId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "")
  const [monto, setMonto] = useState("")
  const [fecha, setFecha] = useState(today)
  const [descripcion, setDescripcion] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!origenId || !destinoId || !monto || origenId === destinoId) return
    onSave(origenId, destinoId, Number(monto), descripcion || `Traspaso ${fecha}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Desde (origen)</label>
        <Select value={origenId} onValueChange={(v) => v && setOrigenId(v)}>
          <SelectTrigger className="h-12 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="w-[28rem] max-w-[calc(100vw-2rem)] p-2">
            {accounts.map((a) => (
              <SelectItem key={a.id} value={a.id} className="py-0">
                <AccountSelectItem account={a} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-center py-1">
        <div className="rounded-full bg-muted p-2">
          <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Hacia (destino)</label>
        <Select value={destinoId} onValueChange={(v) => v && setDestinoId(v)}>
          <SelectTrigger className="h-12 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--anchor-width)] p-2">
            {accounts.filter((a) => a.id !== origenId).map((a) => (
              <SelectItem key={a.id} value={a.id} className="py-0">
                <AccountSelectItem account={a} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Monto (€)</label>
          <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" required autoFocus className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12 text-base" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Descripción</label>
        <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Traspaso a ahorro" className="h-12 text-base" />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="h-11 px-6" disabled={origenId === destinoId}>
          Transferir
        </Button>
      </div>
    </form>
  )
}

export function QuickActionsFAB() {
  const { state, dispatch } = useFinance()
  const [open, setOpen] = useState(false)
  const [activeModal, setActiveModal] = useState<"gasto" | "ingreso" | "traspaso" | null>(null)
  const { toast } = useToast()

  const handleAddTransaction = (t: Transaction) => {
    dispatch({ type: "ADD_TRANSACTION", payload: t })
    setActiveModal(null)
    setOpen(false)
    toast(t.tipo === "gasto" ? "Gasto registrado" : "Ingreso registrado", "success")
  }

  const handleTransfer = (sourceId: string, destId: string, monto: number, descripcion: string) => {
    const source = state.accounts.find((a) => a.id === sourceId)
    const dest = state.accounts.find((a) => a.id === destId)
    if (!source || !dest) return

    const fecha = new Date().toISOString().split("T")[0]
    dispatch({
      type: "ADD_TRANSACTION",
      payload: {
        id: generateId(),
        cuenta_id: sourceId,
        monto,
        fecha,
        tipo: "gasto",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} → ${dest.nombre}`,
        tags: ["traspaso"],
      },
    })
    dispatch({
      type: "ADD_TRANSACTION",
      payload: {
        id: generateId(),
        cuenta_id: destId,
        monto,
        fecha,
        tipo: "ingreso",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} ← ${source.nombre}`,
        tags: ["traspaso"],
      },
    })

    setActiveModal(null)
    setOpen(false)
    toast("Traspaso realizado", "success")
  }

  return (
    <>
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-3">
        {open && (
          <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <button
              onClick={() => setActiveModal("gasto")}
              className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 text-sm font-medium shadow-xl hover:bg-accent hover:scale-105 transition-all"
            >
              <ArrowDownCircle className="h-5 w-5 text-red-500" />
              <span>Gasto</span>
            </button>
            <button
              onClick={() => setActiveModal("ingreso")}
              className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 text-sm font-medium shadow-xl hover:bg-accent hover:scale-105 transition-all"
            >
              <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
              <span>Ingreso</span>
            </button>
            <button
              onClick={() => setActiveModal("traspaso")}
              className="flex items-center gap-3 rounded-xl border bg-card px-5 py-3 text-sm font-medium shadow-xl hover:bg-accent hover:scale-105 transition-all"
            >
              <Send className="h-5 w-5 text-blue-500" />
              <span>Traspaso</span>
            </button>
          </div>
        )}

        <button
          onClick={() => setOpen(!open)}
          className={`flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-all hover:scale-110 active:scale-95 ${
            open
              ? "bg-red-500 rotate-45 shadow-red-500/30"
              : "bg-blue-600 shadow-blue-500/40 hover:bg-blue-500"
          }`}
        >
          <Plus className="h-7 w-7 text-white" />
        </button>
      </div>

      <Dialog open={activeModal === "gasto"} onOpenChange={(o) => { if (!o) setActiveModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">Nuevo Gasto</DialogTitle></DialogHeader>
          <TransactionQuickForm defaultTipo="gasto" accounts={state.accounts} categories={state.categories} onSave={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "ingreso"} onOpenChange={(o) => { if (!o) setActiveModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">Nuevo Ingreso</DialogTitle></DialogHeader>
          <TransactionQuickForm defaultTipo="ingreso" accounts={state.accounts} categories={state.categories} onSave={handleAddTransaction} onCancel={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>

      <Dialog open={activeModal === "traspaso"} onOpenChange={(o) => { if (!o) setActiveModal(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="text-lg">Traspaso entre Cuentas</DialogTitle></DialogHeader>
          <TransferForm accounts={state.accounts} onSave={handleTransfer} onCancel={() => setActiveModal(null)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
