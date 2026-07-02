"use client"

import { useState, useMemo } from "react"
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
import { calculateMonthlySaving } from "@/lib/calculations"
import { CircularProgress } from "@/components/ui/circular-progress"
import { PiggyBank, Plus, Pencil, Trash2, Target, TrendingUp, Clock } from "lucide-react"
import { currencySymbol } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"

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
  const [ahorrado, setAhorrado] = useState(String(fund?.ahorrado_actual ?? ""))
  const [fechaLimite, setFechaLimite] = useState(fund?.fecha_limite ?? "")
  const [cuentaId, setCuentaId] = useState(fund?.cuenta_id ?? accounts[0]?.id ?? "")
  const [ahorradoTocado, setAhorradoTocado] = useState(!!fund?.ahorrado_actual)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre || !objetivo || !fechaLimite || !cuentaId) return
    onSave({
      id: fund?.id ?? generateId(),
      nombre,
      cantidad_objetivo: Number(objetivo),
      ahorrado_actual: Number(ahorrado) || 0,
      fecha_limite: fechaLimite,
      cuenta_id: cuentaId,
    })
  }

  const syncAhorradoFromCuenta = (id: string) => {
    setCuentaId(id)
    if (!ahorradoTocado) {
      const account = accounts.find((a) => a.id === id)
      if (account) setAhorrado(String(account.saldo))
    }
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
          <label className="text-xs text-muted-foreground">Ahorrado actual (€)</label>
          <Input type="number" value={ahorrado} onChange={(e) => { setAhorradoTocado(true); setAhorrado(e.target.value) }} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fecha límite</label>
          <Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Cuenta vinculada</label>
          <Select value={cuentaId} onValueChange={(v) => v && syncAhorradoFromCuenta(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm">{fund ? "Guardar" : "Crear"}</Button>
      </div>
    </form>
  )
}

function PredictionTooltip({ remaining, avgMonthly, symbol }: { remaining: number; avgMonthly: number; symbol: string }) {
  if (remaining <= 0 || avgMonthly <= 0) return null

  const monthsNeeded = Math.ceil(remaining / avgMonthly)
  const estimated = new Date()
  estimated.setMonth(estimated.getMonth() + monthsNeeded)
  const label = estimated.toLocaleDateString("es-ES", { month: "long", year: "numeric" })

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
      <div className="rounded-xl bg-foreground/10 backdrop-blur-xl px-3 py-2 text-[11px] leading-relaxed text-foreground shadow-xl ring-1 ring-border/30 whitespace-nowrap">
        <div className="flex items-center gap-1.5 font-medium">
          <TrendingUp className="h-3 w-3 text-emerald-500" />
          Al ritmo actual (~{avgMonthly.toLocaleString("es-ES")} {symbol}/mes),
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 text-amber-500" />
          completarás en <strong>{monthsNeeded} {monthsNeeded === 1 ? "mes" : "meses"}</strong> ({label})
        </div>
      </div>
    </div>
  )
}

export function SinkingFundsGrid() {
  const { state, loading, dispatch } = useFinance()
  const { toast } = useToast()
  const [editingFund, setEditingFund] = useState<SinkingFund | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SinkingFund | null>(null)

  const averageMonthlySavings = useMemo(() => {
    const now = new Date()
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
    const filtered = state.transactions
      .filter((t) => !t.id.startsWith("init_"))
      .filter((t) => new Date(t.fecha) >= threeMonthsAgo && new Date(t.fecha) <= now)
    const netPerMonth: number[] = []
    for (let i = 0; i < 3; i++) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`
      const monthTxns = filtered.filter((t) => t.fecha.startsWith(key))
      const ingresos = monthTxns.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0)
      const gastos = monthTxns.filter((t) => t.tipo === "gasto").reduce((s, t) => s + t.monto, 0)
      netPerMonth.push(ingresos - gastos)
    }
    const total = netPerMonth.reduce((s, v) => s + v, 0)
    return Math.round(total / netPerMonth.length)
  }, [state.transactions])

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-col gap-3 space-y-0 pb-2 lg:flex-row lg:items-center lg:justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-amber-500" />
          Metas de Ahorro
        </CardTitle>
        <Button size="sm" className="gap-1" onClick={() => setShowNew(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva Meta
        </Button>
        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nueva Meta de Ahorro</DialogTitle>
            </DialogHeader>
            <SinkingFundForm
              accounts={state.accounts}
               onSave={(f) => { dispatch({ type: "ADD_SINKING_FUND", payload: f }); setShowNew(false); toast("Meta de ahorro creada", "success") }}
              onCancel={() => setShowNew(false)}
            />
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {state.sinkingFunds.map((fund) => {
              const progress = fund.cantidad_objetivo > 0 ? Math.min(Math.round((fund.ahorrado_actual / fund.cantidad_objetivo) * 100), 100) : 0
              const monthly = calculateMonthlySaving(fund.cantidad_objetivo, fund.ahorrado_actual, fund.fecha_limite)
              const account = state.accounts.find((a) => a.id === fund.cuenta_id)
              const symbol = currencySymbol(account?.currency ?? "EUR")
              const remaining = fund.cantidad_objetivo - fund.ahorrado_actual
              const circleColor = progress >= 100 ? "var(--accent-green)" : progress >= 50 ? "var(--accent-amber)" : "var(--accent-blue)"

              return (
                <div key={fund.id} className="group relative rounded-2xl border border-border/60 bg-background/70 p-5 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
                  <PredictionTooltip remaining={remaining} avgMonthly={averageMonthlySavings} symbol={symbol} />
                  <button
                    className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteConfirm(fund)}
                    aria-label={`Eliminar meta ${fund.nombre}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                  <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="relative flex items-center justify-center">
                      <CircularProgress value={progress} size={88} strokeWidth={7} color={circleColor} />
                      <span className="absolute text-lg font-bold tabular-nums tracking-tight" style={{ color: circleColor }}>
                        {progress}%
                      </span>
                    </div>
                    <h3
                      className="font-semibold text-sm cursor-pointer hover:text-amber-500 transition-colors flex items-center gap-2 text-center"
                      onClick={() => setEditingFund(fund)}
                    >
                      {fund.nombre}
                      <Pencil className="h-3 w-3 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100" />
                    </h3>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">
                        <Sensitive>{fund.ahorrado_actual.toLocaleString("es-ES")} {symbol}</Sensitive>
                      </p>
                      <p className="text-[11px] text-muted-foreground/60">
                        de <Sensitive>{fund.cantidad_objetivo.toLocaleString("es-ES")} {symbol}</Sensitive>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-center text-[11px] text-muted-foreground">
                    <p>
                      Meta:{" "}
                      {(() => {
                        const d = new Date(fund.fecha_limite)
                        return isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
                      })()}
                    </p>
                    {account && <p>Cuenta: {account.nombre}</p>}
                    {monthly > 0 && (
                      <p className="font-medium text-foreground">
                        <Sensitive as="span" className="tabular-nums">{monthly.toLocaleString("es-ES")} {symbol}/mes</Sensitive>
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
            <DialogTitle>Editar Meta</DialogTitle>
          </DialogHeader>
          {editingFund && (
            <SinkingFundForm
              fund={editingFund}
              accounts={state.accounts}
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
