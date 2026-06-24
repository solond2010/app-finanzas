"use client"

import { useParams, useRouter } from "next/navigation"
import { useFinance } from "@/lib/store"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { ArrowLeft, Pencil, SearchX } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { currencySymbol, formatMoney } from "@/lib/currency"

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { state, dispatch } = useFinance()
  const [editing, setEditing] = useState(false)

  const account = state.accounts.find((a) => a.id === id)
  if (!account) return (
    <div className="flex flex-col items-center justify-center gap-5 py-32 text-center">
      <div className="rounded-full bg-muted/50 p-6 ring-1 ring-border/30">
        <SearchX className="h-10 w-10 text-muted-foreground/40" />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">Cuenta no encontrada</h2>
        <p className="text-sm text-muted-foreground">La cuenta que buscas no existe o ha sido eliminada.</p>
      </div>
      <button onClick={() => router.push("/cuentas")} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97]">
        <ArrowLeft className="h-4 w-4" /> Volver a cuentas
      </button>
    </div>
  )

  const balanceColor = account.saldo >= 0 ? "text-foreground" : "text-red-500"
  const progress = account.objetivo && account.objetivo > 0 ? Math.min((account.saldo / account.objetivo) * 100, 100) : null
  const budgetUsed = account.limite_mensual && account.limite_mensual > 0
    ? (() => {
        const now = new Date()
        const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
        const gastado = state.transactions
          .filter((t) => t.cuenta_id === account.id && t.fecha.startsWith(mes) && t.tipo === "gasto")
          .reduce((s, t) => s + t.monto, 0)
        return Math.min((gastado / account.limite_mensual) * 100, 100)
      })()
    : null

  const totalIngresos = state.transactions
    .filter((t) => t.cuenta_id === account.id && t.tipo === "ingreso")
    .reduce((s, t) => s + t.monto, 0)
  const totalGastos = state.transactions
    .filter((t) => t.cuenta_id === account.id && t.tipo === "gasto")
    .reduce((s, t) => s + t.monto, 0)

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <div className="flex flex-col gap-4 rounded-[28px] bg-card/60 backdrop-blur-xl p-7 shadow-sm ring-1 ring-border/30 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">Cuentas / {tipoLabel(account.tipo)}</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight sm:text-[32px]">{account.nombre}</h1>
          <p className="text-sm text-muted-foreground">{account.banco || "Sin banco"} · {account.currency}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Editar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Saldo actual</p>
            <p className={`text-xl font-bold ${balanceColor}`}>{formatMoney(account.saldo, account.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total ingresos</p>
            <p className="text-xl font-bold text-emerald-500">+{totalIngresos.toLocaleString("es-ES")} {currencySymbol(account.currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total gastos</p>
            <p className="text-xl font-bold text-red-500">-{totalGastos.toLocaleString("es-ES")} {currencySymbol(account.currency)}</p>
          </CardContent>
        </Card>
      </div>

      {progress !== null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progreso hacia objetivo</span>
            <span className="font-medium">{account.saldo.toLocaleString("es-ES")} {currencySymbol(account.currency)} / {account.objetivo!.toLocaleString("es-ES")} {currencySymbol(account.currency)}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {budgetUsed !== null && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Presupuesto del mes</span>
            <span className="font-medium">{Math.round(budgetUsed)}% usado</span>
          </div>
          <Progress value={budgetUsed} className="h-2" />
        </div>
      )}

      <TransactionsTable cuentaId={account.id} />

      {editing && (
        <AccountDialog
          account={account}
          open={editing}
          onOpenChange={setEditing}
          onSave={(a) => { dispatch({ type: "UPDATE_ACCOUNT", payload: a }); setEditing(false) }}
          onDelete={(id) => { dispatch({ type: "DELETE_ACCOUNT", payload: id }); router.push("/cuentas") }}
        />
      )}
    </div>
  )
}

function tipoLabel(tipo: string) {
  const map: Record<string, string> = {
    emergencia: "Emergencia", ahorro: "Ahorro", inversion: "Inversión",
    efectivo: "Efectivo", gastos: "Gastos",
  }
  return map[tipo] || tipo
}
