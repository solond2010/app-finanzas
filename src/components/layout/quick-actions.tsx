"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, Check, Plus, X } from "@/components/icons"
import { ArrowRightLeft, ArrowsLeftRight, HandCoins, Receipt, Repeat2 } from "@/components/icons"
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
import { AccountDot } from "@/components/dashboard/account-dot"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { cn } from "@/lib/utils"
import { transferDescription } from "@/lib/transfer-description"
import { CategoryIcon } from "@/components/icons/category-icon"
import { CategoryIconPicker } from "@/components/categories/category-icon-picker"
import { MAX_CATEGORY_NAME, cleanCategoryName, findBlockingCategory } from "@/lib/category-names"

type MovementType = "gasto" | "ingreso" | "traspaso"

/** Prefill opcional para abrir el modal de movimiento ya relleno (p.ej. desde el dashboard). */
export type MovementPrefill = {
  tipo?: MovementType
  /** Cuenta preelegida (gasto/ingreso, y origen si se cambia a traspaso). */
  cuentaId?: string
  origenId?: string
  destinoId?: string
  monto?: number
  descripcion?: string
  recurrente?: boolean
}

export const OPEN_MOVEMENT_EVENT = "finanzas:open-movement"

/** Abre el FAB de nuevo movimiento con campos opcionales precargados. El usuario confirma. */
export function openMovementDialog(prefill?: MovementPrefill) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent<MovementPrefill>(OPEN_MOVEMENT_EVENT, { detail: prefill ?? {} }))
}

// Opción A (aprobada por Moha): icono dúo grande en pastilla de su color.
// --tipo: rojo/verde/naranja Garra, más oscuros en modo claro para contraste.
const TIPO_OPTIONS: { value: MovementType; label: string; icon: typeof Receipt; tone: string }[] = [
  { value: "gasto", label: "Gasto", icon: Receipt, tone: "[--tipo:#C8372A] dark:[--tipo:#FF6B5B]" },
  { value: "ingreso", label: "Ingreso", icon: HandCoins, tone: "[--tipo:#0B7D59] dark:[--tipo:#2BD9A0]" },
  { value: "traspaso", label: "Traspaso", icon: ArrowsLeftRight, tone: "[--tipo:#A35F00] dark:[--tipo:#F5A524]" },
]

const typeBadge: Record<string, { label: string; color: string }> = {
  emergencia: { label: "Emergencia", color: "text-emerald-500" },
  ahorro: { label: "Ahorro", color: "text-blue-500" },
  inversion: { label: "Inversión", color: "text-violet-500" },
  efectivo: { label: "Efectivo", color: "text-amber-500" },
  gastos: { label: "Gastos", color: "text-red-500" },
}

type ErrorField = "monto" | "montoDestino" | "origen" | "destino" | "cuenta" | "categoria" | "resuelto" | null

/** Aviso de error pegado al campo que hay que corregir. */
function FieldError({ show, message }: { show: boolean; message: string }) {
  if (!show || !message) return null
  return (
    <p role="alert" data-field-error className="flex items-center gap-1.5 text-xs font-medium text-red-500">
      <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {message}
    </p>
  )
}

/** Saldo de la cuenta elegida, dentro del selector cerrado. */
function SelectedBalance({ account }: { account?: Account }) {
  if (!account) return null
  return (
    <span className="ml-auto shrink-0 pl-2 text-xs font-semibold tabular-nums text-muted-foreground">
      <Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive>
    </span>
  )
}

function AccountSelectItem({ account, showBalance = true }: { account: Account; showBalance?: boolean }) {
  const badge = typeBadge[account.tipo]
  return (
    <div className="grid w-full min-w-0 grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 sm:gap-2.5">
      <AccountLogo account={account} className="h-10 w-10 rounded-xl" />
      <div className="min-w-0">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold leading-tight"><AccountDot account={account} /><span className="truncate">{account.nombre}</span></p>
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
  onCreateCategory,
  onCancel,
  initial,
}: {
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  onSaveTransaction: (t: Transaction) => void
  /** Crea la categoría (mismo camino que Configuración). */
  onCreateCategory: (name: string, kind: "gasto" | "ingreso", icon: string | null) => void
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
  // Si se abre desde el detalle de una cuenta, esa cuenta manda sobre la
  // elegida por defecto según el tipo.
  const presetAccount = initial?.cuentaId && accounts.some((a) => a.id === initial.cuentaId) ? initial.cuentaId : null
  // Sin cuenta fijada: la última usada para ese tipo (o la de siempre).
  const lastUsedFor = (t: "gasto" | "ingreso") => {
    let best: Transaction | null = null
    for (const item of transactions) {
      if (item.tipo !== t || item.categoria === "Transferencia" || item.tags?.includes("traspaso") || !accounts.some((a) => a.id === item.cuenta_id)) continue
      const k = item.created_at ?? item.fecha
      if (!best || k > (best.created_at ?? best.fecha)) best = item
    }
    return best?.cuenta_id ?? null
  }
  const accountFor = (t: "gasto" | "ingreso") => presetAccount ?? lastUsedFor(t) ?? defaultAccountFor(t, accounts)
  const [showDetails, setShowDetails] = useState(Boolean(initial?.recurrente || initial?.descripcion))
  const [showCatSelect, setShowCatSelect] = useState(false)
  const [cuentaId, setCuentaId] = useState(() => accountFor(initialTipo === "traspaso" ? "gasto" : initialTipo))
  const [monto, setMonto] = useState(initial?.monto != null && initial.monto > 0 ? String(initial.monto) : "")
  const [fecha, setFecha] = useState(today)
  const [categoria, setCategoria] = useState("")
  // «+ Nueva»: crear una categoría sin salir del diálogo.
  const [newCatOpen, setNewCatOpen] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatIcon, setNewCatIcon] = useState<string | null>(null)
  const [newCatPicker, setNewCatPicker] = useState(false)
  const [newCatMsg, setNewCatMsg] = useState<{ tone: "info" | "error"; text: string } | null>(null)
  const [esNecesidad, setEsNecesidad] = useState(initialTipo !== "ingreso")
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "")
  const [recurrente, setRecurrente] = useState(Boolean(initial?.recurrente))
  const [frecuencia, setFrecuencia] = useState<RecurringFrequency>("mensual")
  const [origenId, setOrigenId] = useState(initial?.origenId || initial?.cuentaId || accounts[0]?.id || "")
  const [montoDestino, setMontoDestino] = useState("")
  const [destinoId, setDestinoId] = useState(() => {
    if (initial?.destinoId) return initial.destinoId
    const fallback = accounts.find((a) => a.id !== (initial?.origenId || initial?.cuentaId || accounts[0]?.id))
    return fallback?.id ?? accounts[0]?.id ?? ""
  })
  const [error, setError] = useState("")
  // Campo al que se refiere el error: el aviso sale justo debajo de ese campo.
  const [errorField, setErrorField] = useState<ErrorField>(null)

  // Al cambiar de tipo, recalcula la cuenta por defecto (gasto → cuenta de
  // gastos/efectivo, ingreso → efectivo/ahorro) y limpia la categoría, que no
  // es válida para el nuevo tipo.
  useEffect(() => {
    if (tipo === "traspaso") return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recompute defaults for the new tipo
    setCuentaId(accountFor(tipo))
    setEsNecesidad(tipo === "gasto")
    setCategoria("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo])

  const createCategory = () => {
    if (tipo === "traspaso") return
    const name = cleanCategoryName(newCatName)
    if (!name) { setNewCatMsg({ tone: "error", text: "Escribe un nombre." }); return }
    const existing = findBlockingCategory(categories, name, tipo)
    if (existing) {
      setCategoria(existing.name)
      setNewCatOpen(false); setNewCatName("")
      setNewCatMsg({ tone: "info", text: `Ya tenías «${existing.name}»; la he elegido.` })
      return
    }
    onCreateCategory(name, tipo, newCatIcon)
    setCategoria(name)
    setNewCatOpen(false); setNewCatName(""); setNewCatIcon(null); setNewCatPicker(false)
    setNewCatMsg({ tone: "info", text: `Categoría «${name}» creada.` })
  }

  const visibleCategories = categories
    .filter((c) => !c.kind || c.kind === tipo || c.kind === "both")
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
  const frequentCategories = Object.entries(transactions
    .filter((item) => item.tipo === tipo && item.categoria !== "Transferencia" && visibleCategories.some((category) => category.name === item.categoria))
    .reduce<Record<string, number>>((counts, item) => { counts[item.categoria] = (counts[item.categoria] ?? 0) + 1; return counts }, {}))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name)

  const fail = (field: ErrorField, message: string) => {
    setErrorField(field)
    setError(message)
    // Lleva la vista al aviso (en móvil el botón queda abajo y el campo arriba).
    requestAnimationFrame(() => document.querySelector("[data-field-error]")?.scrollIntoView({ block: "center", behavior: "smooth" }))
  }
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setErrorField(null)
    const amount = parseAmount(monto)
    if (!amount) { fail("monto", "Indica un importe válido mayor que 0."); return }

    if (tipo === "traspaso") {
      if (!origenId) { fail("origen", "Selecciona la cuenta de origen."); return }
      if (!destinoId) { fail("destino", "Selecciona la cuenta de destino."); return }
      if (origenId === destinoId) { fail("destino", "El origen y el destino no pueden ser la misma cuenta."); return }
      const source = accounts.find((account) => account.id === origenId)
      const destination = accounts.find((account) => account.id === destinoId)
      if (!source || !destination) { fail(null, "No se encontraron las cuentas seleccionadas."); return }
      const receivedAmount = source.currency === destination.currency ? amount : parseAmount(montoDestino)
      if (receivedAmount == null) { fail("montoDestino", `Indica el importe que llegó a la cuenta destino (${currencySymbol(destination.currency)}).`); return }
      onSaveTransfer(origenId, destinoId, amount, receivedAmount, descripcion || "Traspaso", fecha)
      return
    }
    if (!cuentaId) { fail("cuenta", "Selecciona una cuenta."); return }
    if (!categoria) { fail("categoria", "Selecciona una categoría."); return }
    onSaveTransaction({
      id: generateId(),
      cuenta_id: cuentaId,
      monto: amount,
      fecha,
      tipo,
      categoria,
      // Esta clasificación solo aplica a gastos; mantiene los ingresos siempre
      // fuera de las métricas de necesidades y deseos aunque cambie el tipo.
      es_necesidad: tipo === "gasto" ? esNecesidad : false,
      descripcion,
      tags: recurrente
        ? [recurringTag(frecuencia), ...(frecuencia === "mensual" ? [`recurrente-dia:${Number(fecha.slice(8, 10))}`] : [])]
        : [],
    })
  }

  const submitLabel = tipo === "gasto" ? "Guardar gasto" : tipo === "ingreso" ? "Guardar ingreso" : "Transferir"
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
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-[14px] border-[1.5px] px-2 pb-3 pt-3.5 text-sm font-semibold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tipo)]",
                  t.tone,
                  active
                    ? "border-[color-mix(in_oklab,var(--tipo)_55%,transparent)] bg-[color-mix(in_oklab,var(--tipo)_9%,var(--card))] text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted/60"
                )}
              >
                <span className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  active ? "bg-[color-mix(in_oklab,var(--tipo)_22%,transparent)]" : "bg-[color-mix(in_oklab,var(--tipo)_12%,transparent)]"
                )}>
                  <Icon className={cn("h-[22px] w-[22px]", active ? "text-[var(--tipo)]" : "text-[color-mix(in_oklab,var(--tipo)_70%,var(--muted-foreground))]")} />
                </span>
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
                <span className="flex min-w-0 flex-1 items-center gap-2">{accounts.find((a) => a.id === origenId) && <AccountDot account={accounts.find((a) => a.id === origenId)!} />}<span className="min-w-0 truncate"><SelectValue /></span><SelectedBalance account={accounts.find((a) => a.id === origenId)} /></span>
              </SelectTrigger>
              <SelectContent className="w-[min(28rem,calc(100vw-2rem))] p-1.5 sm:p-2">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-14 py-2 pr-10">
                    <AccountSelectItem account={a} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError show={errorField === "origen"} message={error} />
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
                <span className="flex min-w-0 flex-1 items-center gap-2">{accounts.find((a) => a.id === destinoId) && <AccountDot account={accounts.find((a) => a.id === destinoId)!} />}<span className="min-w-0 truncate"><SelectValue /></span><SelectedBalance account={accounts.find((a) => a.id === destinoId)} /></span>
              </SelectTrigger>
              <SelectContent className="w-[min(28rem,calc(100vw-2rem))] p-1.5 sm:p-2">
                {accounts.filter((a) => a.id !== origenId).map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-14 py-2 pr-10">
                    <AccountSelectItem account={a} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError show={errorField === "destino"} message={error} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{montoLabel}</label>
              <Input type="text" inputMode="decimal" value={monto} onChange={(e) => { setMonto(e.target.value); if (errorField === "monto") setErrorField("resuelto") }} placeholder="0,00" required aria-invalid={errorField === "monto" || undefined} className="h-12 text-lg font-semibold tabular-nums" />
              <FieldError show={errorField === "monto"} message={error} />
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Importes frecuentes">
                {[10, 20, 50, 100].map((amount) => <button key={amount} type="button" onClick={() => setMonto(String(amount))} className="min-h-9 rounded-full border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{amount} €</button>)}
              </div>
            </div>
            {(accounts.find((account) => account.id === origenId)?.currency ?? "EUR") !== (accounts.find((account) => account.id === destinoId)?.currency ?? "EUR") && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Importe recibido ({currencySymbol((accounts.find((account) => account.id === destinoId)?.currency ?? "EUR") as CurrencyCode)})</label>
                <Input type="text" inputMode="decimal" value={montoDestino} onChange={(e) => setMontoDestino(e.target.value)} placeholder="0,00" required aria-invalid={errorField === "montoDestino" || undefined} className="h-12 text-base tabular-nums" />
                <FieldError show={errorField === "montoDestino"} message={error} />
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

          </div>
        </>
      ) : (
        <>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">{montoLabel}</label>
              <Input type="text" inputMode="decimal" value={monto} onChange={(e) => { setMonto(e.target.value); if (errorField === "monto") setErrorField("resuelto") }} placeholder="0,00" required aria-invalid={errorField === "monto" || undefined} autoFocus className="h-16 text-center text-3xl font-bold tabular-nums" />
              <FieldError show={errorField === "monto"} message={error} />
              <div className="flex flex-wrap justify-center gap-1.5 pt-1" aria-label="Importes frecuentes">
                {[10, 20, 50, 100].map((amount) => <button key={amount} type="button" onClick={() => setMonto(String(amount))} className="min-h-9 rounded-full border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{amount} €</button>)}
              </div>
            </div>
            <div className={cn("space-y-1.5", newCatOpen && "sm:col-span-2")}>
              <label className="text-sm font-medium text-foreground">Categoría</label>
              {(showCatSelect || frequentCategories.length === 0 || (categoria && !frequentCategories.includes(categoria))) && <Select value={categoria} onValueChange={(v) => { if (v) { setCategoria(v); if (errorField === "categoria") setErrorField("resuelto") } }}>
                <SelectTrigger className="h-12 w-full text-sm">
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent className="p-2">
                  {visibleCategories.map((c) => (
                    <SelectItem key={c.id} value={c.name} className="py-2.5 text-sm">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>}
              <FieldError show={errorField === "categoria"} message={error} />
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Categorías frecuentes">
                {frequentCategories.map((name) => <button key={name} type="button" onClick={() => { setCategoria(name); if (errorField === "categoria") setErrorField("resuelto") }} aria-pressed={categoria === name} className={cn("min-h-9 rounded-full border px-3 text-xs font-medium transition-colors", categoria === name ? "border-primary/45 bg-primary/10 text-primary" : "border-border bg-background/50 text-muted-foreground hover:text-foreground")}>{name}</button>)}
                {frequentCategories.length > 0 && !showCatSelect && <button type="button" onClick={() => setShowCatSelect(true)} className="min-h-9 rounded-full border border-border bg-background/50 px-3 text-xs font-medium text-muted-foreground hover:text-foreground">Más…</button>}
                {!newCatOpen && (
                  <button type="button" onClick={() => { setNewCatOpen(true); setNewCatMsg(null) }} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-primary/45 px-3 text-xs font-medium text-primary transition-colors hover:bg-primary/10">
                    <Plus className="h-3 w-3" /> Nueva
                  </button>
                )}
              </div>
              {newCatOpen && (
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setNewCatPicker((v) => !v)}
                    aria-expanded={newCatPicker}
                    aria-label="Elegir icono de la nueva categoría"
                    title="Elegir icono"
                    className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors", newCatPicker ? "border-primary/60 bg-primary/10" : "border-border bg-background/40 hover:bg-muted/70")}
                  >
                    <CategoryIcon name={newCatName} icon={newCatIcon} className="size-4" />
                  </button>
                  <Input
                    autoFocus
                    value={newCatName}
                    onChange={(e) => { setNewCatName(e.target.value.slice(0, MAX_CATEGORY_NAME)); setNewCatMsg(null) }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); createCategory() }
                      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setNewCatOpen(false); setNewCatName("") }
                    }}
                    placeholder={tipo === "ingreso" ? "Nueva categoría de ingreso" : "Nueva categoría de gasto"}
                    aria-label="Nombre de la nueva categoría"
                    className="h-10 min-w-0 flex-1 text-base sm:text-sm"
                  />
                  <Button type="button" size="icon" onClick={createCategory} aria-label="Crear categoría" className="h-10 w-10 shrink-0"><Check className="h-4 w-4" /></Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => { setNewCatOpen(false); setNewCatName(""); setNewCatIcon(null); setNewCatPicker(false); setNewCatMsg(null) }} aria-label="Cancelar nueva categoría" className="h-10 w-10 shrink-0 text-muted-foreground"><X className="h-4 w-4" /></Button>
                </div>
              )}
              {newCatOpen && newCatPicker && <CategoryIconPicker value={newCatIcon} onChange={setNewCatIcon} name={newCatName} />}
              {newCatMsg && <p role={newCatMsg.tone === "error" ? "alert" : "status"} className={cn("text-xs", newCatMsg.tone === "error" ? "text-red-500" : "text-muted-foreground")}>{newCatMsg.text}</p>}
            </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Cuenta</label>
            <Select value={cuentaId} onValueChange={(v) => { if (v) { setCuentaId(v); if (errorField === "cuenta") setErrorField("resuelto") } }} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
              <SelectTrigger className="h-12 w-full text-sm">
                <span className="flex min-w-0 flex-1 items-center gap-2">{accounts.find((a) => a.id === cuentaId) && <AccountDot account={accounts.find((a) => a.id === cuentaId)!} />}<span className="min-w-0 truncate"><SelectValue /></span><SelectedBalance account={accounts.find((a) => a.id === cuentaId)} /></span>
              </SelectTrigger>
              <SelectContent className="w-[min(28rem,calc(100vw-2rem))] p-1.5 sm:p-2">
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-14 py-2 pr-10">
                    <AccountSelectItem account={a} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError show={errorField === "cuenta"} message={error} />
          </div>

          <button type="button" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails} className="flex w-full items-center justify-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            {fecha === today ? "Hoy" : fecha === yesterday ? "Ayer" : fecha} · <span className="underline underline-offset-2">{showDetails ? "Ocultar detalles" : "Añadir nota, fecha u otros detalles"}</span>
          </button>
          {showDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Fecha</label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="h-12 text-base" />
              <div className="flex gap-1.5 pt-1">
                {[{ label: "Hoy", value: today }, { label: "Ayer", value: yesterday }].map((option) => <button key={option.label} type="button" onClick={() => setFecha(option.value)} aria-pressed={fecha === option.value} className={cn("min-h-9 rounded-full border px-3 text-xs font-medium transition-colors", fecha === option.value ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{option.label}</button>)}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Descripción</label>
              <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={tipo === "ingreso" ? "Ej: Nómina de junio" : "Ej: Compra en Mercadona"} className="h-12 text-base" />
            </div>
              </div>
          {tipo === "gasto" && (
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
          )}

          <div className="rounded-2xl border border-border/80 bg-background/45 p-3.5">
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
          )}
        </>
      )}

      {error && errorField === null && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
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
        descripcion: transferDescription(descripcion, source.nombre, dest.nombre),
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
        descripcion: transferDescription(descripcion, source.nombre, dest.nombre),
        tags: transferTags,
        },
      ],
    })

    setDialogOpen(false)
    toast("Traspaso realizado", "success")
  }

  return (
    <>
      {!dialogOpen && (
        <button
          type="button"
          onClick={() => openMovementDialog()}
          aria-label="Nuevo movimiento"
          title="Nuevo movimiento"
          className="fixed right-4 z-[45] flex size-14 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--gold-foreground)] shadow-[0_12px_30px_-8px_color-mix(in_oklch,var(--gold),transparent_35%)] ring-4 ring-background/70 transition-transform hover:brightness-110 active:scale-90 focus-visible:outline-none focus-visible:ring-primary bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom)+14px)] lg:bottom-6 lg:right-6 lg:size-[60px]"
        >
          <Plus className="size-7" strokeWidth={2.4} />
        </button>
      )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setPrefill(undefined) }}>
        <DialogContent className="z-[70] sm:max-w-md max-sm:bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] max-sm:max-h-[calc(100svh-var(--bottom-nav-h)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
          <DialogHeader>
            <DialogTitle className="text-lg">Nuevo movimiento</DialogTitle>
            <DialogDescription>Añade un gasto, ingreso o traspaso.</DialogDescription>
          </DialogHeader>
          {dialogOpen && state.accounts.length === 0 && (
            // Sin cuentas no hay dónde apuntar el movimiento: se guía a crear la primera.
            <div className="space-y-4 py-2 text-sm">
              <p className="text-muted-foreground">Para apuntar un movimiento primero necesitas una cuenta (por ejemplo, tu cuenta del banco o el efectivo).</p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Ahora no</Button>
                <Button nativeButton={false} render={<Link href="/cuentas" onClick={() => setDialogOpen(false)} />}>Crear mi primera cuenta</Button>
              </div>
            </div>
          )}
          {dialogOpen && state.accounts.length > 0 && (
            <UnifiedMovementForm
              key={prefill ? `prefill-${prefill.cuentaId ?? ""}-${prefill.tipo}-${prefill.origenId}-${prefill.destinoId}-${prefill.monto}-${prefill.recurrente ? "recurrente" : ""}` : "blank"}
              accounts={state.accounts}
              categories={state.categories}
              transactions={state.transactions}
              initial={prefill}
              onSaveTransaction={handleAddTransaction}
              onCreateCategory={(name, kind, icon) => dispatch({ type: "ADD_CATEGORY", payload: { name, color: "#64748b", kind, icon } })}
              onSaveTransfer={handleTransfer}
              onCancel={() => setDialogOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
