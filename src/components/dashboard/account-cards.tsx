"use client"

import { useState } from "react"
import { useFinance, type Account } from "@/lib/store"
import { useRouter } from "next/navigation"
import { Plus, Trash2, CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountDialog } from "./account-dialog"
import { useToast } from "@/components/ui/toast"
import { currencySymbol, formatMoney } from "@/lib/currency"
import { getAccountsAtMonth, getGastosBudgetProgress } from "@/lib/calculations"

const typeConfig = {
  emergencia: { label: "Emergencia", gradient: "from-emerald-500/20 to-emerald-600/5" },
  ahorro: { label: "Ahorro", gradient: "from-blue-500/20 to-blue-600/5" },
  inversion: { label: "Inversión", gradient: "from-violet-500/20 to-violet-600/5" },
  efectivo: { label: "Efectivo", gradient: "from-amber-500/20 to-amber-600/5" },
  gastos: { label: "Gastos", gradient: "from-red-500/20 to-red-600/5" },
}

export function AccountCards({ selectedMonth }: { selectedMonth?: string }) {
  const { state, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showNew, setShowNew] = useState(false)
  const displayAccounts = selectedMonth ? getAccountsAtMonth(state.accounts, state.transactions, selectedMonth) : state.accounts
  const budget = getGastosBudgetProgress(displayAccounts, state.transactions, selectedMonth)

  const isRevolut = (account: Account) => account.nombre.toLowerCase().includes("revolut")
  const isSantander = (account: Account) => account.nombre.toLowerCase().includes("santander")

  return (
    <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {displayAccounts.map((account) => {
        const cfg = typeConfig[account.tipo]
        const progress = account.objetivo
          ? Math.min(Math.round((account.saldo / account.objetivo) * 100), 100)
          : null

        const isGastos = account.tipo === "gastos"
        const revolut = isRevolut(account)
        const santander = isSantander(account)

        return (
          <div
            key={account.id}
            className={`relative overflow-hidden rounded-3xl border bg-card/95 p-5 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer group shadow-sm ${santander ? "border-l-4 border-l-red-600/80" : "border-border/60"}`}
            onClick={() => router.push(`/cuentas/${account.id}`)}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-40`} />
            {revolut && (
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#163f8a] via-[#7b61ff] to-[#00d9d0] opacity-80" />
            )}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{cfg.label}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm("¿Eliminar esta cuenta?")) { dispatch({ type: "DELETE_ACCOUNT", payload: account.id }); toast("Cuenta eliminada", "success") }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
              <div>
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background/70 text-muted-foreground shadow-sm">
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xl font-bold tracking-tight tabular-nums">{formatMoney(account.saldo, account.currency)}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {account.nombre}{account.banco ? <span className="opacity-60"> · {account.banco}</span> : null}
                      </p>
                      {revolut && (
                        <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                          Revolut
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {isGastos && budget && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Presupuesto mensual</span>
                    <span className={budget.progreso >= 100 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                      {budget.gastado.toLocaleString("es-ES")} {currencySymbol(account.currency)} / {budget.limite.toLocaleString("es-ES")} {currencySymbol(account.currency)}
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
                      ? `Te quedan ${budget.restante.toLocaleString("es-ES")} ${currencySymbol(account.currency)}`
                      : `Te has pasado por ${Math.abs(budget.restante).toLocaleString("es-ES")} ${currencySymbol(account.currency)}`}
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
        className="rounded-3xl border-2 border-dashed border-muted-foreground/30 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-muted-foreground/60 hover:text-foreground transition-all cursor-pointer bg-card/70"
        onClick={() => setShowNew(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Nueva Cuenta</span>
      </button>

      <div className="col-span-full rounded-2xl border border-border/60 bg-muted/30 p-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {state.accounts.length} cuentas · Haz clic en cualquier tarjeta para editarla
        </p>
      </div>

      <AccountDialog
        account={editingAccount ?? undefined}
        open={editingAccount !== null}
        onOpenChange={(open) => { if (!open) setEditingAccount(null) }}
        onSave={(a) => { dispatch({ type: "UPDATE_ACCOUNT", payload: a }); setEditingAccount(null) }}
      />

      <AccountDialog
        open={showNew}
        onOpenChange={setShowNew}
        onSave={(a) => { dispatch({ type: "ADD_ACCOUNT", payload: a }); setShowNew(false) }}
      />
    </div>
  )
}
