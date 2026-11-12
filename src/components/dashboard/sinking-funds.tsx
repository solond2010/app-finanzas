"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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
import { useFinance, type SinkingFund, generateId } from "@/lib/store"
import { calculateMonthlySaving, fundCurrentAmount } from "@/lib/calculations"
import { PiggyBank, Plus, Pencil, Trash2, Target, AlertCircle } from "@/components/icons"
import { currencySymbol } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { parseAmount } from "@/lib/validation"
import { parseLocalDate } from "@/lib/date-utils"

function SinkingFundForm({
  fund,
  accounts,
  onSave,
  onCancel,
}: {
  fund?: SinkingFund
  accounts: { id: string; nombre: string; saldo: number }[]
  onSave: (f: SinkingFund) => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(fund?.nombre ?? "")
  const [objetivo, setObjetivo] = useState(String(fund?.cantidad_objetivo ?? ""))
  const [fechaLimite, setFechaLimite] = useState(fund?.fecha_limite ?? "")
  const [cuentaId, setCuentaId] = useState(fund?.cuenta_id ?? accounts[0]?.id ?? "")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (!nombre.trim()) { setError("Ponle un nombre a la meta."); return }
    if (!fechaLimite) { setError("Indica una fecha límite."); return }
    if (!cuentaId) { setError("Selecciona una cuenta vinculada."); return }

    const cantidadObjetivo = parseAmount(objetivo)
    if (!cantidadObjetivo) { setError("El objetivo debe ser un importe mayor que 0."); return }

    // ahorrado_actual ya no se edita a mano: el progreso siempre se calcula en
    // vivo a partir del saldo real de la cuenta vinculada (fundCurrentAmount).
    // Se guarda una foto del saldo actual solo como respaldo por si la cuenta
    // llegara a borrarse más adelante.
    const ahorradoActual = accounts.find((a) => a.id === cuentaId)?.saldo ?? 0

    onSave({
      id: fund?.id ?? generateId(),
      nombre: nombre.trim(),
      cantidad_objetivo: cantidadObjetivo,
      ahorrado_actual: ahorradoActual,
      fecha_limite: fechaLimite,
      cuenta_id: cuentaId,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs text-muted-foreground">Nombre</label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Coche Nuevo" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Objetivo (€)</label>
          <Input type="number" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fecha límite</label>
          <Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} required />
        </div>
        <div className="sm:col-span-2 space-y-1.5">
          <label className="text-xs text-muted-foreground">Cuenta vinculada</label>
          <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)} items={Object.fromEntries(accounts.map((a) => [a.id, a.nombre]))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">El progreso se calcula solo con el saldo real de esta cuenta.</p>
        </div>
      </div>
      {error && (
        <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm">{fund ? "Guardar" : "Crear"}</Button>
      </div>
    </form>
  )
}

export function SinkingFundsGrid() {
  const { state, loading, dispatch } = useFinance()
  const displayAccounts = state.accounts
  const { toast } = useToast()
  const [editingFund, setEditingFund] = useState<SinkingFund | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SinkingFund | null>(null)



  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-amber-500" />
          Metas de ahorro
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva meta
        </Button>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva meta de ahorro</DialogTitle>
            </DialogHeader>
            <SinkingFundForm
              accounts={displayAccounts}
               onSave={(f) => { dispatch({ type: "ADD_SINKING_FUND", payload: f }); setShowNew(false); toast("Meta de ahorro creada", "success") }}
              onCancel={() => setShowNew(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
          </div>
        ) : state.sinkingFunds.length === 0 ? (
          <EmptyState
            className="py-10"
            icon={Target}
            tone="amber"
            title="Aún no tienes metas de ahorro"
            description="Define un objetivo y sigue tu progreso mes a mes."
            action={{ label: "Crear primera meta", icon: Plus, onClick: () => setShowNew(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {state.sinkingFunds.map((fund) => {
              const ahorradoActual = fundCurrentAmount(fund, displayAccounts)
              const progress = fund.cantidad_objetivo > 0 ? Math.min(Math.round((ahorradoActual / fund.cantidad_objetivo) * 100), 100) : 0
              const monthly = calculateMonthlySaving(fund.cantidad_objetivo, ahorradoActual, fund.fecha_limite)
              const account = displayAccounts.find((a) => a.id === fund.cuenta_id)
              const symbol = currencySymbol(account?.currency ?? "EUR")
              const done = progress >= 100
              const barColor = done ? "bg-emerald-500" : "bg-[var(--gold)]"
              const pctColor = done ? "text-emerald-500" : "text-[var(--gold)]"

              return (
                <div key={fund.id} className="group relative rounded-[14px] border border-border bg-card p-5 transition-colors hover:border-primary/30">
                  <button
                    className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteConfirm(fund)}
                    aria-label={`Eliminar meta ${fund.nombre}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                  <div className="flex items-start gap-3 pr-6">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklch,var(--gold),transparent_86%)] text-[var(--gold)]">
                      <PiggyBank className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3>
                        <button
                          type="button"
                          aria-label={`Editar meta ${fund.nombre}`}
                          className="inline-flex max-w-full items-center gap-2 rounded-md text-[15px] font-semibold tracking-tight transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                          onClick={() => setEditingFund(fund)}
                        >
                          <span className="truncate">{fund.nombre}</span>
                          <Pencil aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100" />
                        </button>
                      </h3>
                      {account && <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{account.nombre}</p>}
                    </div>
                    <span className={`shrink-0 text-sm font-bold tabular-nums ${pctColor}`}>{progress}%</span>
                  </div>
                  <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${progress} % de la meta`}>
                    <div className={`h-full rounded-full transition-[width] duration-500 ${barColor}`} style={{ width: `${progress}%` }} />
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-2 text-sm">
                    <p className="font-semibold tabular-nums text-foreground">
                      {/* max 2 decimales: el valor de mercado trae decimales largos y
                          "511,647 €" se lee como seiscientos mil, no como 511,65 */}
                      <Sensitive>{ahorradoActual.toLocaleString("es-ES", { useGrouping: "always", maximumFractionDigits: 2 })} {symbol}</Sensitive>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      de <Sensitive>{fund.cantidad_objetivo.toLocaleString("es-ES", { useGrouping: "always" })} {symbol}</Sensitive>
                    </p>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
                    <p>
                      Meta:{" "}
                      {(() => {
                        const d = parseLocalDate(fund.fecha_limite)
                        return isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
                      })()}
                    </p>
                    {monthly > 0 && (
                      <p className="font-medium text-foreground">
                        <span className="mr-1 text-muted-foreground">Aportación necesaria:</span><Sensitive as="span" className="tabular-nums">{monthly.toLocaleString("es-ES", { useGrouping: "always" })} {symbol}/mes</Sensitive>
                      </p>
                    )}

                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={editingFund !== null} onOpenChange={(open) => { if (!open) setEditingFund(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar meta</DialogTitle>
          </DialogHeader>
          {editingFund && (
            <SinkingFundForm
              fund={editingFund}
              accounts={displayAccounts}
              onSave={(f) => { dispatch({ type: "UPDATE_SINKING_FUND", payload: f }); setEditingFund(null) }}
              onCancel={() => setEditingFund(null)}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) { dispatch({ type: "DELETE_SINKING_FUND", payload: deleteConfirm.id }); toast("Meta eliminada", "success") }}}
        title="¿Eliminar esta meta?"
        description={`Se eliminará "${deleteConfirm?.nombre}". No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
      />
    </Card>
  )
}
