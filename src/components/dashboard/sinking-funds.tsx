"use client"

import { useState } from "react"
import { useToast } from "@/components/ui/toast"
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

function SinkingFundForm({
  fund,
  accounts,
  onSave,
  onCancel,
}: {
  fund?: SinkingFund
  accounts: { id: string; nombre: string }[]
  onSave: (f: SinkingFund) => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(fund?.nombre ?? "")
  const [objetivo, setObjetivo] = useState(String(fund?.cantidad_objetivo ?? ""))
  const [ahorrado, setAhorrado] = useState(String(fund?.ahorrado_actual ?? ""))
  const [fechaLimite, setFechaLimite] = useState(fund?.fecha_limite ?? "")
  const [cuentaId, setCuentaId] = useState(fund?.cuenta_id ?? accounts[0]?.id ?? "")

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

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Nombre</label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Coche Nuevo" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Objetivo (€)</label>
          <Input type="number" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Ahorrado actual (€)</label>
          <Input type="number" value={ahorrado} onChange={(e) => setAhorrado(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fecha límite</label>
          <Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Cuenta vinculada</label>
          <Select value={cuentaId} onValueChange={(v) => v && setCuentaId(v)}>
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

  return (
    <Card className="col-span-full border-border/60 bg-card/95 shadow-sm">
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
              const progress = Math.min(Math.round((fund.ahorrado_actual / fund.cantidad_objetivo) * 100), 100)
              const monthly = calculateMonthlySaving(fund.cantidad_objetivo, fund.ahorrado_actual, fund.fecha_limite)
              const account = state.accounts.find((a) => a.id === fund.cuenta_id)

              return (
                <div key={fund.id} className="group relative rounded-2xl border border-border/60 bg-background/70 p-5 space-y-3 shadow-sm">
                  <button
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => { dispatch({ type: "DELETE_SINKING_FUND", payload: fund.id }); toast("Meta eliminada", "success") }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                  </button>
                  <h3
                    className="font-semibold text-sm cursor-pointer hover:text-amber-500 transition-colors flex items-center gap-2"
                    onClick={() => setEditingFund(fund)}
                  >
                    {fund.nombre}
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  </h3>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-medium tabular-nums">
                        {fund.ahorrado_actual.toLocaleString("es-ES")}€ / {fund.cantidad_objetivo.toLocaleString("es-ES")}€
                      </span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    <p>
                      Meta:{" "}
                      {new Date(fund.fecha_limite).toLocaleDateString("es-ES", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    {account && <p>Cuenta: {account.nombre}</p>}
                    {monthly > 0 && (
                      <p className="font-medium text-foreground">
                        Ahorro necesario: <span className="tabular-nums">{monthly.toLocaleString("es-ES")}€/mes</span>
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
    </Card>
  )
}
