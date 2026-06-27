"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
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
import { PiggyBank, Plus, Pencil, Trash2, Target } from "lucide-react"
import { currencySymbol } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"

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
  const [ahorradoTocado, setAhorradoTocado] = useState(false)

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
    if (!fund && !ahorradoTocado) {
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

export function SinkingFundsGrid() {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [editingFund, setEditingFund] = useState<SinkingFund | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<SinkingFund | null>(null)

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
        {state.sinkingFunds.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">
            <div className="flex flex-col items-center gap-2 py-6">
              <Target className="h-8 w-8 text-muted-foreground/40" />
              <span className="text-sm text-muted-foreground">No hay metas de ahorro. ¡Crea la primera!</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {state.sinkingFunds.map((fund) => {
              const progress = fund.cantidad_objetivo > 0 ? Math.min(Math.round((fund.ahorrado_actual / fund.cantidad_objetivo) * 100), 100) : 0
              const monthly = calculateMonthlySaving(fund.cantidad_objetivo, fund.ahorrado_actual, fund.fecha_limite)
              const account = state.accounts.find((a) => a.id === fund.cuenta_id)
              const symbol = currencySymbol(account?.currency ?? "EUR")

              return (
                <div key={fund.id} className="group relative rounded-2xl border border-border/60 bg-background/70 p-5 space-y-3 shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
                  <button
                    className="absolute top-3 right-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteConfirm(fund)}
                    aria-label={`Eliminar meta ${fund.nombre}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                  <h3
                    className="font-semibold text-sm cursor-pointer hover:text-amber-500 transition-colors flex items-center gap-2"
                    onClick={() => setEditingFund(fund)}
                  >
                    {fund.nombre}
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-100 sm:opacity-0 sm:group-hover:opacity-100" />
                  </h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium tabular-nums">
                        <Sensitive>{fund.ahorrado_actual.toLocaleString("es-ES")} {symbol}</Sensitive> / <Sensitive>{fund.cantidad_objetivo.toLocaleString("es-ES")} {symbol}</Sensitive>
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
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
                        Ahorro necesario: <Sensitive as="span" className="tabular-nums">{monthly.toLocaleString("es-ES")} {symbol}/mes</Sensitive>
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
