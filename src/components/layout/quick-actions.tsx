"use client"

import { useEffect, useState } from "react"
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
import { useFinance, type Transaction, type Account, type Category, generateId } from "@/lib/store"
import { formatMoney } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"

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
          <Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive>
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
  categories: Category[]
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

  const visibleCategories = categories
    .filter((c) => !c.kind || c.kind === defaultTipo || c.kind === "both")
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

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
        <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Monto (€)</label>
          <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" required autoFocus className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12 text-base" />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Categoría</label>
          <Select value={categoria} onValueChange={(v) => v && setCategoria(v)}>
            <SelectTrigger className="h-12 w-full text-sm">
              <SelectValue placeholder="Seleccionar categoría" />
            </SelectTrigger>
            <SelectContent className="p-2">
              {visibleCategories.map((c) => (
                <SelectItem key={c.id} value={c.name} className="py-2.5 text-sm">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Descripción</label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Nómina junio" className="h-12 text-base" />
        </div>
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
  onSave: (sourceId: string, destId: string, monto: number, descripcion: string, fecha?: string) => void
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
    onSave(origenId, destinoId, Number(monto), descripcion || `Traspaso`, fecha)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Desde (origen)</label>
        <Select value={origenId} onValueChange={(v) => v && setOrigenId(v)} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
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
        <Select value={destinoId} onValueChange={(v) => v && setDestinoId(v)} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Monto (€)</label>
          <Input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" required autoFocus className="h-12 text-base" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Fecha</label>
          <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-12 text-base" />
        </div>

        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-sm font-medium text-foreground">Descripción</label>
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Traspaso a ahorro" className="h-12 text-base" />
        </div>
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

  // En móvil el FAB flota fijo sobre el contenido con scroll y puede acabar
  // tapando cifras justo debajo (ej. la puntuación financiera o una tarjeta
  // de resumen). Al detectar scroll activo lo encogemos y atenuamos, y
  // recupera su tamaño normal en cuanto el usuario deja de desplazarse.
  const [isScrolling, setIsScrolling] = useState(false)
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    const onScroll = () => {
      setIsScrolling(true)
      clearTimeout(timeout)
      timeout = setTimeout(() => setIsScrolling(false), 350)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      clearTimeout(timeout)
    }
  }, [])

  const handleAddTransaction = (t: Transaction) => {
    dispatch({ type: "ADD_TRANSACTION", payload: t })
    setActiveModal(null)
    setOpen(false)
    toast(t.tipo === "gasto" ? "Gasto registrado" : "Ingreso registrado", "success")
  }

  const handleTransfer = (sourceId: string, destId: string, monto: number, descripcion: string, fecha?: string) => {
    const source = state.accounts.find((a) => a.id === sourceId)
    const dest = state.accounts.find((a) => a.id === destId)
    if (!source || !dest) return

    const txFecha = fecha || new Date().toISOString().split("T")[0]
    dispatch({
      type: "ADD_TRANSACTION",
      payload: {
        id: generateId(),
        cuenta_id: sourceId,
        monto,
        fecha: txFecha,
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
        fecha: txFecha,
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
      <div
        className={`fixed right-5 bottom-[calc(var(--bottom-nav-h)+1rem)] z-50 flex flex-col items-end gap-3 transition-all duration-300 lg:right-8 lg:bottom-8 ${
          isScrolling && !open ? "scale-90 opacity-60" : "scale-100 opacity-100"
        }`}
      >
        {open && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setActiveModal("gasto")}
              className="stagger-fade-fast flex items-center gap-3 rounded-xl bg-card/95 backdrop-blur-xl px-5 py-3 text-sm font-medium shadow-2xl shadow-black/10 ring-1 ring-border/30 hover:bg-accent hover:scale-105 transition-all"
              style={{ animationDelay: "0ms" }}
            >
              <ArrowDownCircle className="h-5 w-5 text-red-500" />
              <span>Gasto</span>
            </button>
            <button
              onClick={() => setActiveModal("ingreso")}
              className="stagger-fade-fast flex items-center gap-3 rounded-xl bg-card/95 backdrop-blur-xl px-5 py-3 text-sm font-medium shadow-2xl shadow-black/10 ring-1 ring-border/30 hover:bg-accent hover:scale-105 transition-all"
              style={{ animationDelay: "80ms" }}
            >
              <ArrowUpCircle className="h-5 w-5 text-emerald-500" />
              <span>Ingreso</span>
            </button>
            <button
              onClick={() => setActiveModal("traspaso")}
              className="stagger-fade-fast flex items-center gap-3 rounded-xl bg-card/95 backdrop-blur-xl px-5 py-3 text-sm font-medium shadow-2xl shadow-black/10 ring-1 ring-border/30 hover:bg-accent hover:scale-105 transition-all"
              style={{ animationDelay: "160ms" }}
            >
              <Send className="h-5 w-5 text-blue-500" />
              <span>Traspaso</span>
            </button>
          </div>
        )}

        <div className="relative">
          {!open && (
            <span className="absolute inset-0 rounded-full animate-spin-slow" style={{ boxShadow: "0 0 0 2px color-mix(in oklch, var(--gold), transparent 70%), 0 0 20px 4px color-mix(in oklch, var(--gold), transparent 75%)" }} />
          )}
          <button
            onClick={() => setOpen(!open)}
            className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${
              open
                ? "bg-rose-500 rotate-45 shadow-rose-500/30"
                : "bg-gradient-to-br from-[var(--gold)] to-[color-mix(in_oklch,var(--gold),oklch(1_0_0)_18%)] shadow-xl shadow-[color-mix(in_oklch,var(--gold),transparent_55%)] hover:shadow-2xl"
            }`}
          >
            <Plus className={`h-7 w-7 transition-transform duration-300 ${open ? "text-white" : "text-[var(--gold-foreground)]"}`} />
          </button>
        </div>
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
