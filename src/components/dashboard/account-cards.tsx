"use client"

import { useState } from "react"
import { useFinance, type Account } from "@/lib/store"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Wallet } from "lucide-react"

import { AccountDialog } from "./account-dialog"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { currencySymbol, formatMoney } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { getAccountsAtMonth, getGastosBudgetProgress } from "@/lib/calculations"
import { typeConfig } from "@/lib/account-types"

export function AccountCards({ selectedMonth }: { selectedMonth?: string }) {
  const { state, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)
  const displayAccounts = selectedMonth ? getAccountsAtMonth(state.accounts, state.transactions, selectedMonth) : state.accounts
  const budget = getGastosBudgetProgress(displayAccounts, state.transactions, selectedMonth)

  const isRevolut = (account: Account) => account.nombre.toLowerCase().includes("revolut")
  const isSantander = (account: Account) => account.nombre.toLowerCase().includes("santander")

  return (
    <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {displayAccounts.map((account, idx) => {
        const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
        const progress = account.objetivo
          ? Math.min(Math.round((account.saldo / account.objetivo) * 100), 100)
          : null

        const isGastos = account.tipo === "gastos"
        const revolut = isRevolut(account)
        const santander = isSantander(account)

        return (
          <div
            key={account.id}
            className={`stagger-fade relative overflow-hidden rounded-[20px] bg-card/70 backdrop-blur-xl p-5 shadow-sm ring-1 ring-border/20 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 cursor-pointer group ${santander ? "border-l-4 border-l-red-600/70" : ""}`}
            style={{ animationDelay: `${idx * 80}ms` }}
            onClick={() => router.push(`/cuentas/${account.id}`)}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${cfg.tint} opacity-50`} />
            {revolut && (
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#163f8a] via-[#7b61ff] to-[#00d9d0]" />
            )}
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg p-1.5" style={{ backgroundColor: `${cfg.color}15` }}>
                    <Wallet className="h-3.5 w-3.5" style={{ color: cfg.color }} />
                  </div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{cfg.label}</span>
                </div>
                <button
                  className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 touch-manipulation"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirm(account)
                  }}
                  aria-label={`Eliminar cuenta ${account.nombre}`}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
                </button>
              </div>
              <div>
                <div className="min-w-0 flex-1">
                  <p className="text-[26px] font-bold tracking-tight tabular-nums leading-none"><Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive></p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <p className="truncate text-xs text-muted-foreground">
                      {account.nombre}{account.banco ? <span className="opacity-60"> · {account.banco}</span> : null}
                    </p>
                    {revolut && (
                      <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300">
                        Revolut
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {isGastos && budget && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Presupuesto mensual</span>
                    <span className={budget.progreso >= 100 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                      <Sensitive>{budget.gastado.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive> / <Sensitive>{budget.limite.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive>
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ease-out ${budget.progreso >= 100 ? "bg-red-500" : "bg-red-400"}`}
                      style={{ width: `${budget.progreso}%` }}
                    />
                  </div>
                  <p className={`text-[10px] ${budget.restante >= 0 ? "text-muted-foreground" : "text-red-500 font-medium"}`}>
                    {budget.restante >= 0
                      ? <>Te quedan <Sensitive>{budget.restante.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive></>
                      : <>Te has pasado por <Sensitive>{Math.abs(budget.restante).toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive></>}
                  </p>
                </div>
              )}

              {progress !== null && !isGastos && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progreso hacia objetivo</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%`, backgroundColor: account.color }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}

      <button
        className="rounded-[20px] border-2 border-dashed border-muted-foreground/25 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-md cursor-pointer bg-card/50 backdrop-blur-sm ring-1 ring-border/10"
        onClick={() => setShowNew(true)}
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Nueva Cuenta</span>
      </button>

      <div className="col-span-full rounded-2xl bg-muted/30 backdrop-blur-sm p-4 flex items-center justify-between ring-1 ring-border/10 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-sm">
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

      <ConfirmDialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
        onConfirm={() => { if (deleteConfirm) { dispatch({ type: "DELETE_ACCOUNT", payload: deleteConfirm.id }); toast("Cuenta eliminada", "success") }}}
        title="¿Eliminar esta cuenta?"
        description={`Se eliminará "${deleteConfirm?.nombre}" y todas sus transacciones. No se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
      />
    </div>
  )
}
