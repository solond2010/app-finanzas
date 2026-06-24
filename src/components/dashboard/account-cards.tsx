"use client"

import { useState } from "react"
import { useFinance, type Account, generateId } from "@/lib/store"
import { getGastosBudgetProgress } from "@/lib/calculations"
import { Plus, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const typeConfig = {
  emergencia: { label: "Emergencia", gradient: "from-emerald-500/20 to-emerald-600/5" },
  ahorro: { label: "Ahorro", gradient: "from-blue-500/20 to-blue-600/5" },
  inversion: { label: "Inversión", gradient: "from-violet-500/20 to-violet-600/5" },
  efectivo: { label: "Efectivo", gradient: "from-amber-500/20 to-amber-600/5" },
  gastos: { label: "Gastos", gradient: "from-red-500/20 to-red-600/5" },
}

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#f97316"]

function AccountForm({
  account,
  onSave,
  onCancel,
}: {
  account?: Account
  onSave: (a: Account) => void
  onCancel: () => void
}) {
  const [nombre, setNombre] = useState(account?.nombre ?? "")
  const [tipo, setTipo] = useState<Account["tipo"]>(account?.tipo ?? "efectivo")
  const [banco, setBanco] = useState(account?.banco ?? "")
  const [saldo, setSaldo] = useState(String(account?.saldo ?? 0))
  const [objetivo, setObjetivo] = useState(String(account?.objetivo ?? ""))
  const [limiteMensual, setLimiteMensual] = useState(String(account?.limite_mensual ?? ""))
  const [color, setColor] = useState(account?.color ?? COLORS[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      id: account?.id ?? generateId(),
      nombre,
      tipo,
      banco,
      saldo: Number(saldo) || 0,
      objetivo: objetivo ? Number(objetivo) : null,
      limite_mensual: limiteMensual ? Number(limiteMensual) : null,
      color,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Nombre</label>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Emergencias" required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as Account["tipo"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="emergencia">Emergencia</SelectItem>
              <SelectItem value="ahorro">Ahorro</SelectItem>
              <SelectItem value="inversion">Inversión</SelectItem>
              <SelectItem value="efectivo">Efectivo</SelectItem>
              <SelectItem value="gastos">Gastos Mensuales</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Banco</label>
          <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ej: Trade Republic" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Saldo (€)</label>
          <Input type="number" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Objetivo (€)</label>
          <Input type="number" value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Sin objetivo" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Color</label>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`h-6 w-6 rounded-full border-2 transition-all ${color === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
      </div>

      {tipo === "gastos" && (
        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Límite mensual de gasto (€)</label>
          <Input type="number" value={limiteMensual} onChange={(e) => setLimiteMensual(e.target.value)} placeholder="Ej: 2000" />
          <p className="text-[10px] text-muted-foreground">Este límite se usará para mostrar el progreso de tu presupuesto mensual</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" size="sm">{account ? "Guardar" : "Crear"}</Button>
      </div>
    </form>
  )
}

export function AccountCards() {
  const { state, dispatch } = useFinance()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showNew, setShowNew] = useState(false)
  const budget = getGastosBudgetProgress(state.accounts, state.transactions)

  return (
    <div className="col-span-full grid grid-cols-4 gap-4">
      {state.accounts.map((account) => {
        const cfg = typeConfig[account.tipo]
        const progress = account.objetivo
          ? Math.min(Math.round((account.saldo / account.objetivo) * 100), 100)
          : null

        const isGastos = account.tipo === "gastos"

        return (
          <div
            key={account.id}
            className="relative overflow-hidden rounded-2xl border bg-card p-5 transition-all hover:shadow-lg hover:scale-[1.02] cursor-pointer group"
            onClick={() => setEditingAccount(account)}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-50`} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm("¿Eliminar esta cuenta?")) dispatch({ type: "DELETE_ACCOUNT", payload: account.id })
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight tabular-nums">{account.saldo.toLocaleString("es-ES")}€</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {account.nombre}{account.banco ? <span className="opacity-60"> · {account.banco}</span> : null}
                </p>
              </div>

              {isGastos && budget && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Presupuesto mensual</span>
                    <span className={budget.progreso >= 100 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                      {budget.gastado.toLocaleString("es-ES")}€ / {budget.limite.toLocaleString("es-ES")}€
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budget.progreso >= 100 ? "bg-red-500" : "bg-red-400"}`}
                      style={{ width: `${budget.progreso}%` }}
                    />
                  </div>
                  <p className={`text-[10px] ${budget.restante >= 0 ? "text-muted-foreground" : "text-red-500 font-medium"}`}>
                    {budget.restante >= 0
                      ? `Te quedan ${budget.restante.toLocaleString("es-ES")}€`
                      : `Te has pasado por ${Math.abs(budget.restante).toLocaleString("es-ES")}€`}
                  </p>
                </div>
              )}

              {progress !== null && !isGastos && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progreso</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: account.color }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <button
        className="rounded-2xl border-2 border-dashed border-muted-foreground/30 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-all cursor-pointer"
        onClick={() => setShowNew(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Nueva Cuenta</span>
      </button>

      <div className="col-span-full rounded-xl border bg-muted/30 p-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {state.accounts.length} cuentas · Haz clic en cualquier tarjeta para editarla
        </p>
      </div>

      <Dialog open={editingAccount !== null} onOpenChange={(open) => { if (!open) setEditingAccount(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cuenta</DialogTitle></DialogHeader>
          {editingAccount && (
            <AccountForm account={editingAccount} onSave={(a) => { dispatch({ type: "UPDATE_ACCOUNT", payload: a }); setEditingAccount(null) }} onCancel={() => setEditingAccount(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nueva Cuenta</DialogTitle></DialogHeader>
          <AccountForm onSave={(a) => { dispatch({ type: "ADD_ACCOUNT", payload: a }); setShowNew(false) }} onCancel={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
