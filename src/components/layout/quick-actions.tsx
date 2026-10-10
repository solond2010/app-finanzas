"use client"

import { useEffect, useState } from "react"
import { AlertCircle } from "lucide-react"
import { ArrowRightLeft, ArrowDownCircle, ArrowUpCircle, Repeat2, Send } from "lucide-react"
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
import { parseAmount } from "@/lib/validation"
import { localDateKey } from "@/lib/date-utils"
import { formatMoney, currencySymbol, type CurrencyCode } from "@/lib/currency"
import { recurringTag, type RecurringFrequency } from "@/lib/calculations"
import { Sensitive } from "@/components/shared/sensitive"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { cn } from "@/lib/utils"

type MovementType = "gasto" | "ingreso" | "traspaso"

/** Prefill opcional para abrir el modal de movimiento ya relleno (p.ej. desde el dashboard). */
export type MovementPrefill = {
  tipo?: MovementType
  origenId?: string
  destinoId?: string
  monto?: number
  descripcion?: string
}

export const OPEN_MOVEMENT_EVENT = "finanzas:open-movement"

/** Abre el FAB de nuevo movimiento con campos opcionales precargados. El usuario confirma. */
export function openMovementDialog(prefill?: MovementPrefill) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<MovementPrefill>(OPEN_MOVEMENT_EVENT, { detail: prefill ?? {} }))
}

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
    <div className="grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 sm:gap-2.5">
      <AccountLogo account={account} className="h-10 w-10 rounded-xl" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">{account.nombre}</p>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <p className="min-w-0 truncate text-xs leading-tight text-muted-foreground">{account.banco || "Sin banco"}</p>
          {badge && (
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
      {showBalance && (
        <span className="max-w-[6.25rem] whitespace-nowrap text-right text-[11px] font-semibold tabular-nums text-foreground/90 sm:max-w-[7.5rem] sm:text-sm">
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
  transactions,
  onSaveTransaction,
  onSaveTransfer,
  onCancel,
  initial,
}: {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  onSaveTransaction: (t: Transaction) => void
  onSaveTransfer: (sourceId: string, destId: string, sourceAmount: number, destinationAmount: number, descripcion: string, fecha: string) => void
  onCancel: () => void
  initial?: MovementPrefill
}) {
  const today = localDateKey()
  const yesterdayDate = new Date()
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterday = localDateKey(yesterdayDate)
  const initialTipo: MovementType = initial?.tipo ?? "gasto"

  const [tipo, setTipo] = useState<MovementType>(initialTipo)
  const [cuentaId, setCuentaId] = useState(() => defaultAccountFor(initialTipo === "traspaso" ? "gasto" : initialTipo, accounts))
  const [monto, setMonto] = useState(initial?.monto != null && initial.monto > 0 ? String(initial.monto) : "")
  const [fecha, setFecha] = useState(today)
  const [categoria, setCategoria] = useState("")
  const [esNecesidad, setEsNecesidad] = useState(initialTipo !== "ingreso")
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "")
  const [recurrente, setRecurrente] = useState(false)
  const [frecuencia, setFrecuencia] = useState<RecurringFrequency>("mensual")
  const [origenId, setOrigenId] = useState(initial?.origenId || accounts[0]?.id || "")
  const [montoDestino, setMontoDestino] = useState("")
  const [destinoId, setDestinoId] = useState(() => {
    if (initial?.destinoId) return initial.destinoId
    const fallback = accounts.find((a) => a.id !== (initial?.origenId || accounts[0]?.id))
    return fallback?.id ?? accounts[0]?.id ?? ""
  })
  const [error, setError] = useState("")

  // Al cambiar de tipo, recalcula la cuenta por defecto (gasto → cuenta de
  // gastos/efectivo, ingreso → efectivo/ahorro) y limpia la categoría, que no
  // es válida para el nuevo tipo.
  useEffect(() => {
    if (tipo === "traspaso") return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recompute defaults for the new tipo
    setCuentaId(defaultAccountFor(tipo, accounts))
    setEsNecesidad(tipo === "gasto")
    setCategoria("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  const visibleCategories = categories
    .filter((c) => !c.kind || c.kind === tipo || c.kind === "both")
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
  const frequentCategories = Object.entries(transactions
    .filter((item) => item.tipo === tipo && item.categoria !== "Transferencia" && visibleCategories.some((category) => category.name === item.categoria))
    .reduce<Record<string, number>>((counts, item) => { counts[item.categoria] = (counts[item.categoria] ?? 0) + 1; return counts }, {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name]) => name)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const amount = parseAmount(monto)
    if (!amount) { setError("Indica un importe válido mayor que 0."); return }

    if (tipo === "traspaso") {
      if (!origenId || !destinoId) { setError("Selecciona cuenta de origen y destino."); return }
      if (origenId === destinoId) { setError("El origen y el destino no pueden ser la misma cuenta."); return }
      const source = accounts.find((account) => account.id === origenId)
      const destination = accounts.find((account) => account.id === destinoId)
      if (!source || !destination) { setError("No se encontraron las cuentas seleccionadas."); return }
      const receivedAmount = source.currency === destination.currency ? amount : parseAmount(montoDestino)
      if (receivedAmount == null) { setError(`Indica el importe que llegó a la cuenta destino (${currencySymbol(destination.currency)}).`); return }
      onSaveTransfer(origenId, destinoId, amount, receivedAmount, descripcion || "Traspaso", fecha)
      return
    }
    if (!cuentaId) { setError("Selecciona una cuenta."); return }
    if (!categoria) { setError("Selecciona una categoría."); return }
    onSaveTransaction({
      id: generateId(),
      cuenta_id: cuentaId,
      monto: amount,
      fecha,
      tipo,
      categoria,
      es_necesidad: esNecesidad,
      descripcion,
      tags: recurrente
        ? [recurringTag(frecuencia), ...(frecuencia === "mensual" ? [`recurrente-dia:${Number(fecha.slice(8, 10))}`] : [])]
        : [],
    })
  }

  const submitLabel = tipo === "gasto" ? "Registrar gasto" : tipo === "ingreso" ? "Registrar ingreso" : "Transferir"
  const submitDisabled = tipo === "traspaso" && origenId === destinoId

  const selectedAccountId = tipo === "traspaso" ? origenId : cuentaId
  const selectedCurrency = (accounts.find((a) => a.id === selectedAccountId)?.currency ?? "EUR") as CurrencyCode
  const montoLabel = `Monto (${currencySymbol(selectedCurrency)})`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">Tipo</label>
        <div className="grid grid-cols-3 gap-2">
          {TIPO_OPTIONS.map((t) => {
            const Icon = t.icon
            const active = tipo === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-all active:scale-[0.98]",
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? t.color : "")} />
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tipo === "traspaso" ? (
        <>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Desde (origen)</label>
            <Select value={origenId} onValueChange={(v) => { if (v) { setOrigenId(v); setMontoDestino("") } }} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
              <SelectTrigger className="h-12 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[min(28rem,calc(100vw-2rem))] p-1.5 sm:p-2">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-14 py-2 pr-10">
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
            <Select value={destinoId} onValueChange={(v) => { if (v) { setDestinoId(v); setMontoDestino("") } }} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
              <SelectTrigger className="h-12 w-full text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="w-[min(28rem,calc(100vw-2rem))] p-1.5 sm:p-2">
                {accounts.filter((a) => a.id !== origenId).map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-14 py-2 pr-10">
                    <AccountSelectItem account={a} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{montoLabel}</label>
              <Input type="text" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0,00" required className="h-12 text-lg font-semibold tabular-nums" />
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Importes frecuentes">
                {[10, 20, 50, 100].map((amount) => <button key={amount} type="button" onClick={() => setMonto(String(amount))} className="min-h-9 rounded-full border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{amount} €</button>)}
              </div>
            </div>
            {(accounts.find((account) => account.id === origenId)?.currency ?? "EUR") !== (accounts.find((account) => account.id === destinoId)?.currency ?? "EUR") && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Importe recibido ({currencySymbol((accounts.find((account) => account.id === destinoId)?.currency ?? "EUR") as CurrencyCode)})</label>
                <Input type="text" inputMode="decimal" value={montoDestino} onChange={(e) => setMontoDestino(e.target.value)} placeholder="0,00" required className="h-12 text-base tabular-nums" />
                <p className="text-xs text-muted-foreground">Introduce lo que realmente llegó, después del cambio y las comisiones.</p>
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="h-12 text-base" />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium text-foreground">Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Traspaso a ahorro" className="h-12 text-base" />
            </div>

            <div className="sm:col-span-2 rounded-2xl border border-border/80 bg-background/45 p-3.5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={recurrente}
                  onChange={(event) => setRecurrente(event.target.checked)}
                  className="mt-0.5 size-4 accent-[var(--gold)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><Repeat2 className="size-4 text-primary" /> Repetir este movimiento</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">Se añadirá a Agenda como previsión. No cambia el saldo hasta que confirmes que ya ocurrió.</span>
                </span>
              </label>
              {recurrente && (
                <div className="mt-3 flex items-center gap-3 pl-7">
                  <label htmlFor="movement-frequency" className="text-xs font-medium text-muted-foreground">Frecuencia</label>
                  <Select value={frecuencia} onValueChange={(value) => value && setFrecuencia(value as RecurringFrequency)}>
                    <SelectTrigger id="movement-frequency" className="h-10 w-40 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semanal">Cada semana</SelectItem>
                      <SelectItem value="mensual">Cada mes</SelectItem>
                      <SelectItem value="anual">Cada año</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
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
              <SelectContent className="w-[min(28rem,calc(100vw-2rem))] p-1.5 sm:p-2">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-14 py-2 pr-10">
                    <AccountSelectItem account={a} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{montoLabel}</label>
              <Input type="text" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0,00" required className="h-12 text-lg font-semibold tabular-nums" />
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Importes frecuentes">
                {[10, 20, 50, 100].map((amount) => <button key={amount} type="button" onClick={() => setMonto(String(amount))} className="min-h-9 rounded-full border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{amount} €</button>)}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="h-12 text-base" />
              <div className="flex gap-1.5 pt-1">
                {[{ label: "Hoy", value: today }, { label: "Ayer", value: yesterday }].map((option) => <button key={option.label} type="button" onClick={() => setFecha(option.value)} aria-pressed={fecha === option.value} className={cn("min-h-9 rounded-full border px-3 text-xs font-medium transition-colors", fecha === option.value ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{option.label}</button>)}
              </div>
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
              {frequentCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Categorías frecuentes">
                  {frequentCategories.map((name) => <button key={name} type="button" onClick={() => setCategoria(name)} aria-pressed={categoria === name} className={cn("min-h-9 rounded-full border px-3 text-xs font-medium transition-colors", categoria === name ? "border-primary/45 bg-primary/10 text-primary" : "border-border bg-background/50 text-muted-foreground hover:text-foreground")}>{name}</button>)}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: Nómina junio" className="h-12 text-base" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Clasificación</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEsNecesidad(true)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]",
                  esNecesidad
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                )}
              >
                Necesidad
              </button>
              <button
                type="button"
                onClick={() => setEsNecesidad(false)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all active:scale-[0.98]",
                  !esNecesidad
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                )}
              >
                Deseo
              </button>
            </div>
          </div>
        </>
      )}

      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
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
  const [prefill, setPrefill] = useState<MovementPrefill | undefined>()
  const { toast } = useToast()

  // Permite abrir el mismo modal desde otras pantallas (dashboard "Preparar traspaso")
  // con origen/destino/importe ya rellenados; el usuario sigue confirmando a mano.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<MovementPrefill>).detail
      setPrefill(detail && Object.keys(detail).length > 0 ? detail : undefined)
      setDialogOpen(true)
    }
    window.addEventListener(OPEN_MOVEMENT_EVENT, handler)
    return () => window.removeEventListener(OPEN_MOVEMENT_EVENT, handler)
  }, [])

  const handleAddTransaction = (t: Transaction) => {
    dispatch({ type: "ADD_TRANSACTION", payload: t })
    setDialogOpen(false)
    toast(t.tipo === "gasto" ? "Gasto registrado" : "Ingreso registrado", "success")
  }

  const handleTransfer = (sourceId: string, destId: string, sourceAmount: number, destinationAmount: number, descripcion: string, fecha: string) => {
    const source = state.accounts.find((a) => a.id === sourceId)
    const dest = state.accounts.find((a) => a.id === destId)
    if (!source || !dest) return
    const transferId = generateId()
    const transferTags = ["traspaso", `traspaso:${transferId}`]

    dispatch({
      type: "ADD_TRANSFER",
      payload: [
        {
        id: generateId(),
        cuenta_id: sourceId,
        monto: sourceAmount,
        fecha,
        tipo: "gasto",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} → ${dest.nombre}`,
        tags: transferTags,
        },
        {
        id: generateId(),
        cuenta_id: destId,
        monto: destinationAmount,
        fecha,
        tipo: "ingreso",
        categoria: "Transferencia",
        es_necesidad: false,
        descripcion: `${descripcion} ← ${source.nombre}`,
        tags: transferTags,
        },
      ],
    })

    setDialogOpen(false)
    toast("Traspaso realizado", "success")
  }

  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPrefill(undefined) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">Nuevo movimiento</DialogTitle>
            <DialogDescription>Añade un gasto, ingreso o traspaso.</DialogDescription>
          </DialogHeader>
          {dialogOpen && (
            <UnifiedMovementForm
              key={prefill ? `prefill-${prefill.tipo}-${prefill.origenId}-${prefill.destinoId}-${prefill.monto}` : "blank"}
              accounts={state.accounts}
              categories={state.categories}
              transactions={state.transactions}
              initial={prefill}
              onSaveTransaction={handleAddTransaction}
              onSaveTransfer={handleTransfer}
              onCancel={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
