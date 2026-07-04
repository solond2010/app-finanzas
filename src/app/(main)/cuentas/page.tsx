"use client"

import { useRouter } from "next/navigation"
import { useFinance, type Account } from "@/lib/store"
import { usePortfolioValue, accountDisplayValue } from "@/lib/investments"
import { accountGoal } from "@/lib/calculations"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Wallet as WalletIcon, Plus, Target, TrendingUp } from "lucide-react"
import { formatMoney, currencySymbol } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { typeConfig } from "@/lib/account-types"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { useMemo, useState } from "react"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { useToast } from "@/components/ui/toast"
import { TickerTile } from "@/components/shared/ticker-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { money } from "@/lib/format"

export default function CuentasPage() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const { valueByAccount, investedByAccount } = usePortfolioValue()
  const [showNewAccount, setShowNewAccount] = useState(false)

  // Para cuentas de inversión, el saldo bruto no baja al comprar una posición
  // (no genera un gasto): se sustituye solo la parte ya invertida por su valor
  // de mercado, dejando intacto el efectivo restante aún sin invertir.
  const accountValue = (a: Account) => accountDisplayValue(a, valueByAccount, investedByAccount)
  const netWorth = state.accounts.reduce((s, a) => s + accountValue(a), 0)

  // Cuenta con mayor saldo y cuenta más cerca de completar su objetivo, para
  // el ticker superior (solo cuando hay cuentas registradas).
  const topAccount = useMemo(() => (state.accounts.length === 0 ? null : state.accounts.slice().sort((a, b) => accountValue(b) - accountValue(a))[0]), [state.accounts, valueByAccount, investedByAccount]) // eslint-disable-line react-hooks/exhaustive-deps
  const nearestGoal = useMemo(() => {
    return state.accounts
      .map((a) => ({ account: a, goal: accountGoal(a, state.sinkingFunds) }))
      .filter((a) => a.goal > 0)
      .map((a) => ({ account: a.account, pct: Math.min((accountValue(a.account) / a.goal) * 100, 100) }))
      .sort((a, b) => b.pct - a.pct)[0] ?? null
  }, [state.accounts, state.sinkingFunds, valueByAccount, investedByAccount]) // eslint-disable-line react-hooks/exhaustive-deps
  const liquidNetWorth = state.accounts.filter((a) => a.tipo !== "inversion").reduce((s, a) => s + accountValue(a), 0)
  const liquidPct = netWorth > 0 ? Math.round((liquidNetWorth / netWorth) * 100) : 0

  // Metas de ahorro (fusionado desde /objetivos): mismos cálculos que tenía esa página.
  const goalStats = useMemo(() => {
    const totalObjetivo = state.sinkingFunds.reduce((s, f) => s + f.cantidad_objetivo, 0)
    const totalAhorrado = state.sinkingFunds.reduce((s, f) => s + f.ahorrado_actual, 0)
    const overallProgress = totalObjetivo > 0 ? Math.round((totalAhorrado / totalObjetivo) * 100) : 0
    return { totalObjetivo, totalAhorrado, overallProgress, count: state.sinkingFunds.length }
  }, [state.sinkingFunds])
  const fundsWithProgress = useMemo(
    () => state.sinkingFunds.map((f) => ({ ...f, pct: f.cantidad_objetivo > 0 ? (f.ahorrado_actual / f.cantidad_objetivo) * 100 : 0, restante: Math.max(f.cantidad_objetivo - f.ahorrado_actual, 0) })),
    [state.sinkingFunds]
  )
  const completedGoals = fundsWithProgress.filter((f) => f.pct >= 100).length
  const nearestGoalFund = fundsWithProgress.filter((f) => f.pct < 100).sort((a, b) => b.pct - a.pct)[0] ?? null
  const biggestEffortFund = fundsWithProgress.filter((f) => f.pct < 100).sort((a, b) => b.restante - a.restante)[0] ?? null
  const totalRestante = Math.max(goalStats.totalObjetivo - goalStats.totalAhorrado, 0)
  const hasMetas = state.sinkingFunds.length > 0

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-section-label">Patrimonio</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saldos, bancos y progreso de objetivos en un vistazo.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] hero-panel px-5 py-3.5 sm:items-end">
          <p className="page-section-label">Patrimonio neto total</p>
          <p className="hero-figure text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-[30px]">
            <Sensitive as="span"><AnimatedNumber value={netWorth} /></Sensitive>
          </p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
          </div>
        </div>
      ) : state.accounts.length === 0 ? (
        <EmptyState
          className="py-24"
          icon={WalletIcon}
          title="Sin cuentas aún"
          description="Añade tu primera cuenta bancaria para empezar a gestionar tus finanzas."
          action={{ label: "Crear primera cuenta", icon: Plus, onClick: () => setShowNewAccount(true) }}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <TickerTile label="Cuentas" value={String(state.accounts.length)} valueColor="var(--primary)" />
            <TickerTile label="Cuenta líder" value={topAccount ? formatMoney(accountValue(topAccount), topAccount.currency) : "—"} detail={topAccount?.nombre} valueColor="var(--gold)" />
            <TickerTile label="Objetivo más cerca" value={nearestGoal ? `${Math.round(nearestGoal.pct)}%` : "—"} detail={nearestGoal?.account.nombre} valueColor="var(--accent-green)" />
            <TickerTile label="Liquidez" value={`${liquidPct}%`} valueColor="var(--accent-blue)" />
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.accounts.map((account, index) => {
              const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
              const goal = accountGoal(account, state.sinkingFunds)
              return (
                <button
                  key={account.id}
                  onClick={() => router.push(`/cuentas/${account.id}`)}
                  className="stagger-fade group rounded-[16px] border border-border bg-card p-6 text-left glass-card-hover"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <AccountLogo account={account} className="h-11 w-11" />
                        <div>
                          <h3 className="font-semibold text-base">{account.nombre}</h3>
                          <p className="text-xs text-muted-foreground">{account.banco || "Sin banco"}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground ring-1 ring-border/15">
                        {cfg.label}
                      </span>
                    </div>

                    <div>
                      <p className="text-3xl font-bold tabular-nums tracking-tight">
                        <Sensitive>{formatMoney(accountValue(account), account.currency)}</Sensitive>
                      </p>
                    </div>

                    {goal > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Objetivo: <Sensitive>{goal.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive></span>
                          <span>{Math.round((accountValue(account) / goal) * 100)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.min((accountValue(account) / goal) * 100, 100)}%`,
                              backgroundColor: cfg.color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
            <button
              onClick={() => setShowNewAccount(true)}
              className="stagger-fade flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-muted-foreground/25 p-6 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
              style={{ animationDelay: `${state.accounts.length * 60}ms` }}
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Nueva Cuenta</span>
            </button>
          </div>
        </>
      )}

      <section className="space-y-6 border-t border-border pt-6 sm:space-y-7 sm:pt-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-section-label">Metas de ahorro</p>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Objetivos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Define objetivos, vincula cuentas y sigue tu progreso mes a mes.</p>
          </div>
          {hasMetas && (
            <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card px-4 py-2 sm:self-auto">
              <span className="text-xs text-muted-foreground">Progreso global</span>
              <span className="text-sm font-bold tabular-nums text-foreground"><AnimatedNumber value={goalStats.overallProgress} suffix="%" /></span>
            </div>
          )}
        </div>

        {hasMetas && (
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <TickerTile label="Restante total" value={money(totalRestante)} valueColor="var(--accent-amber)" />
            <TickerTile label="Meta más cerca" value={nearestGoalFund ? `${Math.round(nearestGoalFund.pct)}%` : "—"} detail={nearestGoalFund?.nombre} valueColor="var(--accent-green)" />
            <TickerTile label="Mayor esfuerzo" value={biggestEffortFund ? money(biggestEffortFund.restante) : "—"} detail={biggestEffortFund?.nombre} valueColor="var(--gold)" />
            <TickerTile label="Completadas" value={`${completedGoals}/${goalStats.count}`} valueColor="var(--primary)" />
          </section>
        )}

        {hasMetas && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Metas activas" value={goalStats.count} subtitle="Objetivos en curso" icon={Target} tone="amber" delay={0} />
            <MetricCard label="Total ahorrado" value={<AnimatedNumber value={Math.round(goalStats.totalAhorrado)} />} subtitle="Acumulado de todas las metas" icon={WalletIcon} tone="blue" delay={80} />
            <MetricCard label="Objetivo total" value={<AnimatedNumber value={Math.round(goalStats.totalObjetivo)} />} subtitle="Suma de todas las metas" icon={TrendingUp} tone="violet" delay={160} />
          </section>
        )}

        <SinkingFundsGrid />
      </section>

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={(a) => { dispatch({ type: "ADD_ACCOUNT", payload: a }); setShowNewAccount(false); toast("Cuenta creada", "success") }} />
    </div>
  )
}
