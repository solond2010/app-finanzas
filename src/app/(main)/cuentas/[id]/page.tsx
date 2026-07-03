"use client"

import { useParams, useRouter } from "next/navigation"
import { useFinance } from "@/lib/store"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { ArrowLeft, Pencil, SearchX, Wallet, ArrowUpRight, ArrowDownRight, PiggyBank, TrendingUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useState } from "react"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { PositionDialog } from "@/components/investments/position-dialog"
import { currencySymbol, formatMoney } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { typeConfig } from "@/lib/account-types"
import { usePortfolioValue, accountDisplayValue } from "@/lib/investments"

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { state, dispatch } = useFinance()
  const [editing, setEditing] = useState(false)
  const [investing, setInvesting] = useState(false)
  const { valueByAccount, investedByAccount } = usePortfolioValue()

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

  const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
  const Icon = cfg.icon
  // Para cuentas de inversión, comprar una posición no descuenta su coste del
  // saldo (no genera un gasto): el saldo bruto mezcla efectivo sin invertir +
  // el dinero que ya está en posiciones. displaySaldo separa ambas partes (ver
  // accountDisplayValue) para que el total cuadre con el resto de la app.
  const isInvestment = account.tipo === "inversion"
  const investedCost = investedByAccount[account.id] ?? 0
  const marketValue = valueByAccount[account.id] ?? investedCost
  const idleCash = account.saldo - investedCost
  const displaySaldo = isInvestment ? accountDisplayValue(account, valueByAccount, investedByAccount) : account.saldo
  const progress = account.objetivo && account.objetivo > 0 ? Math.min((displaySaldo / account.objetivo) * 100, 100) : null
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
    <div className="content-fade space-y-6">
      <button onClick={() => router.push("/cuentas")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-all">
        <ArrowLeft className="h-4 w-4" /> Volver
      </button>

      <section className="rounded-[16px] border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
              {cfg.label}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{account.banco || "Sin banco"} · {account.currency}</p>
              <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{account.nombre}</h1>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Saldo actual</p>
              <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-[48px] lg:text-[56px]"
                style={{ color: displaySaldo >= 0 ? cfg.color : "var(--accent-red)" }}>
                <Sensitive>{formatMoney(displaySaldo, account.currency)}</Sensitive>
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" className="gap-1.5 rounded-[16px]" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar cuenta
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="rounded-[16px] border border-border bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total ingresos</span>
              <ArrowUpRight className="h-4 w-4 text-emerald-500" />
            </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-emerald-500">
                <Sensitive>+{totalIngresos.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive>
              </p>
          </div>
        </Card>

        <Card className="rounded-[16px] border border-border bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total gastos</span>
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-red-500">
                <Sensitive>{totalGastos > 0 ? "-" : ""}{totalGastos.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive>
              </p>
          </div>
        </Card>

        <Card className="rounded-[16px] border border-border bg-card p-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Neto histórico</span>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
              <p className={`text-[28px] font-bold leading-none tracking-tight tabular-nums ${totalIngresos - totalGastos >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                <Sensitive>{totalIngresos - totalGastos >= 0 ? "+" : ""}{(totalIngresos - totalGastos).toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive>
              </p>
          </div>
        </Card>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {progress !== null && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Progreso hacia objetivo</p>
                <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-border/20">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground tabular-nums"><Sensitive as="strong">{formatMoney(displaySaldo, account.currency)}</Sensitive></strong> de <span className="tabular-nums"><Sensitive>{formatMoney(account.objetivo!, account.currency)}</Sensitive></span>
              </p>
            </CardContent>
          </Card>
        )}

        {budgetUsed !== null && (
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Presupuesto del mes</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${budgetUsed >= 80 ? "bg-red-500/10 text-red-500" : budgetUsed >= 50 ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"}`}>{Math.round(budgetUsed)}%</span>
              </div>
              <Progress value={budgetUsed} className="h-2" />
              {(budgetUsed >= 80) && <p className="text-xs text-amber-500">Te estás acercando al límite mensual</p>}
            </CardContent>
          </Card>
        )}
      </div>

      {isInvestment && (
        <Card className="rounded-[16px]">
          <CardContent className="space-y-4 p-5 sm:p-6">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Desglose</p>
              <h2 className="text-lg font-bold tracking-tight">De dónde sale el saldo de esta cuenta</h2>
              <p className="mt-1 text-xs text-muted-foreground">Comprar una posición no descuenta su coste del saldo (no genera un gasto), así que el efectivo sin invertir se calcula restando lo ya invertido.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl bg-muted/30 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Wallet className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Efectivo aportado (transacciones)</p>
                  <p className="text-base font-bold tabular-nums"><Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive></p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-muted/30 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><TrendingUp className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Invertido en posiciones (coste)</p>
                  <p className="text-base font-bold tabular-nums">− <Sensitive>{formatMoney(investedCost, account.currency)}</Sensitive></p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-muted/30 p-4">
                <span className="gold-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"><PiggyBank className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">= Efectivo sin invertir</p>
                  <p className="text-base font-bold tabular-nums" style={{ color: "var(--gold)" }}><Sensitive>{formatMoney(idleCash, account.currency)}</Sensitive></p>
                </div>
                {idleCash > 0 && (
                  <Button type="button" size="sm" className="shrink-0 rounded-full" onClick={() => setInvesting(true)}>
                    Invertir esto
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-muted/30 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><TrendingUp className="h-4 w-4" /></span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">+ Valor de mercado de lo invertido</p>
                  <p className="text-base font-bold tabular-nums"><Sensitive>{formatMoney(marketValue, account.currency)}</Sensitive></p>
                </div>
              </div>
            </div>
            {idleCash < 0 && (
              <p className="rounded-xl bg-[color-mix(in_oklch,var(--accent-red),transparent_88%)] p-3 text-xs text-[color-mix(in_oklch,var(--accent-red),black_10%)]">
                El efectivo sin invertir sale negativo: has invertido más de lo que esta cuenta registra como aportado. Revisa el saldo de la cuenta o el precio/unidades de tus posiciones en Inversiones.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Movimientos</p>
        <h2 className="text-xl font-bold tracking-tight">Historial de transacciones</h2>
      </div>

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

      {investing && (
        <PositionDialog open={investing} onOpenChange={setInvesting} defaultAccountId={account.id} />
      )}
    </div>
  )
}
