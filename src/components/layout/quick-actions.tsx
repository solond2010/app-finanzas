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
  DialogDescription,
} from "@/components/ui/dialog"
import { useFinance, type Transaction, type Account, type Category, generateId } from "@/lib/store"
import { formatMoney } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

type MovementType = "gasto" | "ingreso" | "traspaso"

const TIPO_OPTIONS: { value: MovementType; label: string; icon: typeof ArrowDownCircle; color: string }[] = [
  { value: "gasto", label: "Gasto", icon: ArrowDownCircle, color: "text-red-500" },
  { value: "ingreso", label: "Ingreso", icon: ArrowUpCircle, color: "text-emerald-500" },
  { value: "traspaso", label: "Traspaso", icon: Send, color: "text-blue-500" },
]

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

function defaultAccountFor(tipo: MovementType, accounts: Account[]) {
  if (tipo === "gasto") {
    const gastosAccounts = accounts.filter((a) => a.tipo === "gastos" || a.tipo === "efectivo")
    return gastosAccounts[0]?.id ?? accounts[0]?.id ?? ""
  }
  return accounts.find((a) => a.tipo === "efectivo" || a.tipo === "ahorro")?.id ?? accounts[0]?.id ?? ""
}

function UnifiedMovementForm({
  accounts,
  categories,
  onSaveTransaction,
  onSaveTransfer,
  onCancel,
}: {
  accounts: Account[]
  categories: Category[]
  onSaveTransaction: (t: Transaction) => void
  onSaveTransfer: (sourceId: string, destId: string, monto: number, descripcion: string, fecha: string) => void
  onCancel: () => void
}) {
  const today = new Date().toISOString().split("T")[0]

  const [tipo, setTipo] = useState<MovementType>("gasto")
  const [cuentaId, setCuentaId] = useState(() => defaultAccountFor("gasto", accounts))
  const [monto, setMonto] = useState("")
  const [fecha, setFecha] = useState(today)
  const [categoria, setCategoria] = useState("")
  const [esNecesidad, setEsNecesidad] = useState(true)
  const [descripcion, setDescripcion] = useState("")
  const [origenId, setOrigenId] = useState(accounts[0]?.id ?? "")
  const [destinoId, setDestinoId] = useState(accounts[1]?.id ?? accounts[0]?.id ?? "")

  // Al cambiar de tipo, recalcula la cuenta por defecto (gasto → cuenta de
  // gastos/efectivo, ingreso → efectivo/ahorro) y limpia la categoría, que no
  // es válida para el nuevo tipo.
  useEffect(() => {
    if (tipo === "traspaso") return
    setCuentaId(defaultAccountFor(tipo, accounts))
    setEsNecesidad(tipo === "gasto")
    setCategoria("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  const visibleCategories = categories
    .filter((c) => !c.kind || c.kind === tipo || c.kind === "both")
    .sort((a, b) => a.name.localeCompare(b.name, "es"))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (tipo === "traspaso") {
      if (!origenId || !destinoId || !monto || origenId === destinoId) return
      onSaveTransfer(origenId, destinoId, Number(monto), descripcion || "Traspaso", fecha)
      return
    }
    if (!cuentaId || !monto || !categoria) return
    onSaveTransaction({
      id: generateId(),
      cuenta_id: cuentaId,
      monto: Number(monto),
      fecha,
      tipo,
      categoria,
      es_necesidad: esNecesidad,
      descripcion,
      tags: [],
    })
  }

  const submitLabel = tipo === "gasto" ? "Registrar gasto" : tipo === "ingreso" ? "Registrar ingreso" : "Transferir"
  const submitDisabled = tipo === "traspaso" && origenId === destinoId

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Tipo</label>
        <Select value={tipo} onValueChange={(v) => v && setTipo(v as MovementType)} items={Object.fromEntries(TIPO_OPTIONS.map((t) => [t.value, t.label]))}>
          <SelectTrigger className="h-12 w-full text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="p-2">
            {TIPO_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="py-2.5 text-sm">
                <span className="flex items-center gap-2.5">
                  <t.icon className={cn("h-4 w-4", t.color)} />
                  {t.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tipo === "traspaso" ? (
        <>
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
        </>
      ) : (
        <>
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
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" className="h-11 px-6" disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}

export function QuickActionsFAB() {
  const { state, dispatch } = useFinance()
  const [dialogOpen, setDialogOpen] = useState(false)
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
    setDialogOpen(false)
    toast(t.tipo === "gasto" ? "Gasto registrado" : "Ingreso registrado", "success")
  }

  const handleTransfer = (sourceId: string, destId: string, monto: number, descripcion: string, fecha: string) => {
    const source = state.accounts.find((a) => a.id === sourceId)
    const dest = state.accounts.find((a) => a.id === destId)
    if (!source || !dest) return

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

    setDialogOpen(false)
    toast("Traspaso realizado", "success")
  }

  return (
    <>
      <div
        className={`fixed right-5 bottom-[calc(var(--bottom-nav-h)+1rem)] z-50 transition-all duration-300 lg:right-8 lg:bottom-8 ${
          isScrolling ? "scale-90 opacity-60" : "scale-100 opacity-100"
        }`}
      >
        <div className="relative">
          <span className="absolute inset-0 rounded-full animate-spin-slow" style={{ boxShadow: "0 0 0 2px color-mix(in oklch, var(--gold), transparent 70%), 0 0 20px 4px color-mix(in oklch, var(--gold), transparent 75%)" }} />
          <button
            onClick={() => setDialogOpen(true)}
            aria-label="Nuevo movimiento"
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[color-mix(in_oklch,var(--gold),oklch(1_0_0)_18%)] shadow-xl shadow-[color-mix(in_oklch,var(--gold),transparent_55%)] transition-all duration-300 hover:scale-110 hover:shadow-2xl active:scale-95"
          >
            <Plus className="h-7 w-7 text-[var(--gold-foreground)]" />
          </button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Nuevo movimiento</DialogTitle>
            <DialogDescription>Añade un gasto, ingreso o traspaso.</DialogDescription>
          </DialogHeader>
          <UnifiedMovementForm accounts={state.accounts} categories={state.categories} onSaveTransaction={handleAddTransaction} onSaveTransfer={handleTransfer} onCancel={() => setDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
