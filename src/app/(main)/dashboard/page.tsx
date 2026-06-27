"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { LineChart, DonutChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Eye, EyeOff, Plus, Sparkles, Target, TrendingUp, Wallet } from "lucide-react"

import { AccountDialog } from "@/components/dashboard/account-dialog"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/toast"
import { buildMonthlySummariesUpTo, getAccountsAtMonth, getGastosBudgetProgress, getMonthTotalsByString, getNetWorthAtMonth } from "@/lib/calculations"
import { currencySymbol, formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { money, signedMoney, formatMonth, getGreeting, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { AnimatedNumber as AnimatedMoney } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { usePrivacy } from "@/lib/privacy"

import { memo } from "react"

const SnapshotCard = memo(function SnapshotCard({ label, value, subtitle, icon: Icon, color, delay }: { label: string; value: React.ReactNode; subtitle: string; icon: React.ElementType; color: string; delay: number }) {
  return (
    <div className="stagger-fade rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
        <span className="rounded-2xl bg-background/60 p-2 ring-1 ring-border/20">
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
})

const EmptyWelcome = memo(function EmptyWelcome({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[34px] bg-card/70 p-8 text-center shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_10%_100%,rgba(16,185,129,0.14),transparent_35%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.28),transparent_35%),radial-gradient(circle_at_10%_100%,rgba(16,185,129,0.24),transparent_35%)]" />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-5">
        <div className="rounded-[28px] bg-background/70 p-5 shadow-sm ring-1 ring-border/25">
          <Wallet className="h-10 w-10 text-muted-foreground/55" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Primer paso</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Construye tu centro financiero.</h2>
          <p className="text-sm leading-6 text-muted-foreground">Crea tu primera cuenta y empieza a registrar movimientos. El dashboard se convertirá en tu resumen diario de patrimonio, gastos y metas.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button className="gap-2 rounded-full px-5" onClick={onCreateAccount}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
          <Link href="/analytics" className="inline-flex h-9 items-center justify-center rounded-full border border-input bg-background px-5 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.97]">Ver analíticas</Link>
        </div>
      </div>
    </div>
  )
})

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[24px] ${className ?? ""}`} />
}

export default function DashboardPage() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [showNewAccount, setShowNewAccount] = useState(false)

  const selectedDate = useMemo(
    () => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1),
    [today, monthOffset]
  )
  const previousDate = useMemo(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1),
    [selectedDate]
  )
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const previousTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, previousMonth), [analysisTransactions, previousMonth])
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const previousNetWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, previousMonth), [state.accounts, state.transactions, previousMonth])
  const trendData = useMemo(() => buildMonthlySummariesUpTo(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const budget = useMemo(() => getGastosBudgetProgress(displayAccounts, analysisTransactions, selectedMonth), [displayAccounts, analysisTransactions, selectedMonth])

  const netWorthDelta = netWorth - previousNetWorth
  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0
  const expenseDelta = previousTotals.gastos > 0 ? Math.round(((monthTotals.gastos - previousTotals.gastos) / previousTotals.gastos) * 100) : 0
  const healthScore = Math.min(100, Math.max(0, (monthTotals.neto >= 0 ? 35 : 10) + (savingsRate >= 20 ? 30 : savingsRate > 0 ? 15 : 0) + (netWorthDelta >= 0 ? 20 : 5) + (budget && budget.progreso <= 100 ? 15 : budget ? 0 : 10)))
  const primaryInsight = monthTotals.neto >= 0
    ? savingsRate >= 20
      ? "Mes sano: estás generando margen y cumpliendo una tasa de ahorro sólida."
      : "El mes va en positivo; el siguiente paso es elevar el ahorro automático."
    : "Mes en déficit: revisa gastos variables y prioriza recortar categorías no esenciales."

  const safeTime = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime() }

  const recentTransactions = useMemo(
    () => analysisTransactions
      .filter((t) => t.fecha.startsWith(selectedMonth))
      .sort((a, b) => safeTime(b.fecha) - safeTime(a.fecha))
      .slice(0, 5),
    [analysisTransactions, selectedMonth]
  )

  const topAccounts = displayAccounts.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 4)

  const netWorthTrend = useMemo(
    () => [-5, -4, -3, -2, -1, 0].map((offset) => {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), patrimonio: getNetWorthAtMonth(state.accounts, state.transactions, key) }
    }),
    [selectedDate, state.accounts, state.transactions]
  )

  const assetDistribution = useMemo(() => displayAccounts
    .filter((a) => a.saldo !== 0)
    .map((a) => {
      const cfg = typeConfig[a.tipo] ?? typeConfig.efectivo
      return {
        name: a.nombre,
        value: Math.abs(a.saldo),
        color: cfg.color,
      }
    })
    .sort((a, b) => b.value - a.value),
    [displayAccounts]
  )

  const goalProgress = state.sinkingFunds.length > 0
    ? Math.round(state.sinkingFunds.reduce((sum, fund) => sum + Math.min((fund.ahorrado_actual / fund.cantidad_objetivo) * 100, 100), 0) / state.sinkingFunds.length)
    : 0

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          <Skeleton className="h-80" />
        </div>
      ) : !hasAnyData ? (
        <>
          <EmptyWelcome onCreateAccount={() => setShowNewAccount(true)} />
          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[28px] bg-card/70 p-5 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-6">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.16),transparent_30%)] dark:bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.30),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.26),transparent_30%)]" />
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />Dashboard
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${netWorthDelta >= 0 ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" : "bg-red-500/10 text-red-500 ring-red-500/20"}`}>
                    {netWorthDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    <Sensitive>{signedMoney(netWorthDelta)}</Sensitive>
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{getGreeting()} · {formatMonth(selectedDate)}</p>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Patrimonio neto</p>
                  <p className="text-[36px] font-bold leading-none tracking-tight tabular-nums sm:text-[48px]"><AnimatedMoney value={netWorth} /></p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-2xl bg-background/70 p-1 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
                  <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-[120px] text-center text-xs font-bold capitalize tracking-tight sm:min-w-[150px] sm:text-sm">{formatMonth(selectedDate)}</span>
                  <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
                </div>
                <button
                  onClick={togglePrivacy}
                  className="rounded-xl p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90 touch-manipulation ring-1 ring-border/25 bg-background/70"
                  aria-label={privacy ? "Desactivar modo privacidad" : "Activar modo privacidad"}
                >
                  {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotCard label="Ingresos" value={<AnimatedMoney value={monthTotals.ingresos} prefix="+" />} subtitle="Entradas registradas este mes" icon={ArrowUpRight} color="#10b981" delay={0} />
            <SnapshotCard label="Gastos" value={<AnimatedMoney value={monthTotals.gastos} prefix="-" />} subtitle={previousTotals.gastos > 0 ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% vs mes anterior` : "Sin comparativa previa"} icon={ArrowDownRight} color="#ef4444" delay={80} />
            <SnapshotCard label="Neto del mes" value={<AnimatedMoney value={monthTotals.neto} />} subtitle={monthTotals.neto >= 0 ? "Cash flow positivo" : "Cash flow negativo"} icon={CircleDollarSign} color={monthTotals.neto >= 0 ? "#3b82f6" : "#f59e0b"} delay={160} />
            <SnapshotCard label="Ahorro" value={`${savingsRate}%`} subtitle={savingsRate >= 20 ? "Objetivo 20% alcanzado" : savingsRate > 0 ? "Meta recomendada: 20%" : "Cash flow negativo este mes"} icon={Target} color={savingsRate >= 20 ? "#10b981" : "#f59e0b"} delay={240} />
          </section>

          <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="space-y-5">
              <Card className="stagger-fade" style={{ animationDelay: "80ms" }}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><TrendingUp className="h-4 w-4 text-emerald-500" />Patrimonio neto</CardTitle>
                  <span className="text-xs text-muted-foreground">Últimos 6 meses</span>
                </CardHeader>
                <CardContent>
                  {netWorthTrend.every((item) => item.patrimonio === 0) ? (
                    <div className="flex h-[260px] flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 text-center ring-1 ring-border/20">
                      <BarChart3 className="h-8 w-8 text-muted-foreground/35" />
                      <p className="text-sm text-muted-foreground">Añade movimientos para ver la tendencia.</p>
                    </div>
                  ) : (
                    <LineChart data={netWorthTrend} index="mes" categories={["patrimonio"]} colors={["emerald"]} valueFormatter={chartFormatter} yAxisWidth={64} className="h-[260px]" showAnimation />
                  )}
                </CardContent>
              </Card>

              <div className="stagger-fade space-y-3" style={{ animationDelay: "160ms" }}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Últimos movimientos</p>
                  <Link href="/transactions" className="text-xs font-medium text-primary hover:underline">Ver todo</Link>
                </div>
                {recentTransactions.length === 0 ? (
                  <div className="flex h-[120px] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/20 text-center ring-1 ring-border/20">
                    <Activity className="h-6 w-6 text-muted-foreground/35" />
                    <p className="text-sm text-muted-foreground">Sin movimientos en {formatMonth(selectedDate)}.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40 rounded-2xl bg-card/60 ring-1 ring-border/20 backdrop-blur-sm">
                    {recentTransactions.map((transaction) => {
                      const account = state.accounts.find((a) => a.id === transaction.cuenta_id)
                      return (
                        <div key={transaction.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{transaction.descripcion || transaction.categoria}</p>
                            <p className="truncate text-xs text-muted-foreground">{new Date(transaction.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · {account?.nombre ?? "Cuenta"}</p>
                          </div>
                          <p className={`shrink-0 text-sm font-bold tabular-nums ${transaction.tipo === "ingreso" ? "text-emerald-500" : "text-red-500"}`}>
                            <Sensitive>{transaction.tipo === "ingreso" ? "+" : "-"}{transaction.monto.toLocaleString("es-ES")} {currencySymbol(account?.currency ?? "EUR")}</Sensitive>
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <Card className="stagger-fade" style={{ animationDelay: "120ms" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><Wallet className="h-4 w-4 text-muted-foreground" />Cuentas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topAccounts.length === 0 ? (
                    <button onClick={() => setShowNewAccount(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/30 p-6 text-sm text-muted-foreground transition-all hover:border-muted-foreground/50 hover:text-foreground"><Plus className="h-4 w-4" />Nueva cuenta</button>
                  ) : (
                    topAccounts.map((account, index) => {
                      const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                      const Icon = cfg.icon
                      return (
                        <button key={account.id} onClick={() => router.push(`/cuentas/${account.id}`)} className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/25 p-3 text-left ring-1 ring-border/15 transition-all hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm" style={{ animationDelay: `${index * 70}ms` }}>
                          <span className="flex min-w-0 items-center gap-2.5">
                            <span className={`rounded-xl bg-gradient-to-br ${cfg.tint} p-2 ring-1 ring-border/15`}><Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{account.nombre}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{cfg.label}{account.banco ? ` · ${account.banco}` : ""}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-sm font-bold tabular-nums"><Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive></span>
                        </button>
                      )
                    })
                  )}
                  <Button variant="outline" size="sm" className="w-full rounded-2xl" onClick={() => setShowNewAccount(true)}><Plus className="mr-2 h-3.5 w-3.5" />Añadir cuenta</Button>
                </CardContent>
              </Card>

              {assetDistribution.length > 0 && (
                <Card className="stagger-fade" style={{ animationDelay: "200ms" }}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><CircleDollarSign className="h-4 w-4 text-muted-foreground" />Distribución</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <DonutChart data={assetDistribution} category="value" index="name" variant="donut" className="mx-auto h-44 w-44" showAnimation />
                    <div className="mt-3 space-y-1.5">
                      {assetDistribution.map((item) => (
                        <div key={item.name} className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 truncate">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                            {item.name}
                          </span>
                          <Sensitive as="span" className="tabular-nums font-medium">{formatMoney(item.value, displayAccounts.find((a) => a.nombre === item.name)?.currency ?? "EUR")}</Sensitive>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </section>

          <section className="grid grid-cols-12 gap-6">
            <div className="col-span-full space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Operativo</p>
              <h2 className="text-xl font-bold tracking-tight">Historial y metas</h2>
              <p className="max-w-2xl text-sm text-muted-foreground">Transacciones completas y fondos de ahorro con filtros, exportación y edición.</p>
            </div>
            <TransactionsTable selectedMonth={selectedMonth} />
            <SinkingFundsGrid />
          </section>

          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      )}
    </div>
  )
}
