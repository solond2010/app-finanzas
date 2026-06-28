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
    <div className="stagger-fade rounded-3xl bg-white/70 dark:bg-slate-900/70 p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-sm">
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="text-[26px] font-bold leading-none tracking-tight tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  )
})

const EmptyWelcome = memo(function EmptyWelcome({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="hero-gradient rounded-[34px] bg-card/70 p-8 text-center sm:p-14 card-elevated">
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-6">
        <div className="relative">
          <div className="rounded-[28px] bg-background/70 p-5 card-elevated">
            <div className="relative">
              <Wallet className="h-12 w-12 text-muted-foreground/50" />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-lg shadow-primary/30">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>
          </div>
          <span className="absolute -top-2 -left-2 h-3 w-3 rounded-full bg-emerald-500/30 animate-breathe" />
          <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500/30 animate-breathe" style={{ animationDelay: "1.5s" }} />
          <span className="absolute top-1/2 -right-6 h-2 w-2 rounded-full bg-blue-500/30 animate-float-slow" />
          <span className="absolute top-1/3 -left-5 h-1.5 w-1.5 rounded-full bg-violet-500/30 animate-float" />
        </div>
        <div className="space-y-3">
          <p className="page-section-label">Primer paso</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Construye tu centro financiero.</h2>
          <p className="max-w-lg text-sm leading-6 text-muted-foreground mx-auto">Crea tu primera cuenta y empieza a registrar movimientos. El dashboard se convertir&aacute; en tu resumen diario de patrimonio, gastos y metas.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" className="gap-2 rounded-full px-6 shadow-lg shadow-primary/25 animate-count-pulse" onClick={onCreateAccount}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
          <Link href="/analytics" className="inline-flex h-10 items-center justify-center rounded-full border border-input bg-background px-5 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground hover:-translate-y-0.5 active:scale-[0.97]">Ver anal&iacute;ticas</Link>
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
  const budget = useMemo(() => getGastosBudgetProgress(displayAccounts, analysisTransactions, selectedMonth), [displayAccounts, analysisTransactions, selectedMonth])

  const netWorthDelta = netWorth - previousNetWorth
  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0
  const expenseDelta = previousTotals.gastos > 0 ? Math.round(((monthTotals.gastos - previousTotals.gastos) / previousTotals.gastos) * 100) : 0

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

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)

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
          {/* ── Top bar: greeting + month nav + privacy ── */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{getGreeting()}</p>
                <p className="text-xs text-muted-foreground">{formatMonth(selectedDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <nav className="hidden sm:flex items-center gap-1 rounded-2xl bg-white/70 dark:bg-slate-900/70 p-1 ring-1 ring-black/5 dark:ring-white/10">
                {["All", "Transactions", "Analytics"].map((tab) => (
                  <span key={tab} className={`px-3 py-1.5 text-xs font-medium rounded-xl cursor-pointer transition-all ${tab === "All" ? "bg-white dark:bg-slate-800 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab}</span>
                ))}
              </nav>
              <div className="flex items-center rounded-2xl bg-white/70 dark:bg-slate-900/70 p-1 ring-1 ring-black/5 dark:ring-white/10">
                <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-white dark:hover:bg-slate-800 hover:text-foreground active:scale-90" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-[110px] text-center text-xs font-bold capitalize tracking-tight">{formatMonth(selectedDate)}</span>
                <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-1.5 text-muted-foreground transition-all hover:bg-white dark:hover:bg-slate-800 hover:text-foreground active:scale-90" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <button onClick={togglePrivacy} className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70 dark:bg-slate-900/70 text-muted-foreground hover:text-foreground ring-1 ring-black/5 dark:ring-white/10 transition-all active:scale-90" aria-label={privacy ? "Desactivar modo privacidad" : "Activar modo privacidad"}>
                {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* ── Snapshot metrics row ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SnapshotCard label="Ingresos" value={<AnimatedMoney value={monthTotals.ingresos} prefix="+" />} subtitle="Entradas del mes" icon={ArrowUpRight} color="#10b981" delay={0} />
            <SnapshotCard label="Gastos" value={<AnimatedMoney value={monthTotals.gastos} prefix="-" />} subtitle={previousTotals.gastos > 0 ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% vs anterior` : "Sin comparativa"} icon={ArrowDownRight} color="#ef4444" delay={80} />
            <SnapshotCard label="Neto del mes" value={<AnimatedMoney value={monthTotals.neto} />} subtitle={monthTotals.neto >= 0 ? "Cash flow positivo" : "Cash flow negativo"} icon={CircleDollarSign} color={monthTotals.neto >= 0 ? "#3b82f6" : "#f59e0b"} delay={160} />
            <SnapshotCard label="Ahorro" value={`${savingsRate}%`} subtitle={savingsRate >= 20 ? "Objetivo 20% alcanzado" : savingsRate > 0 ? "Meta: 20%" : "Cash flow negativo"} icon={Target} color={savingsRate >= 20 ? "#10b981" : "#f59e0b"} delay={240} />
          </div>

          {/* ── Bento grid: 3 columns ── */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* ── LEFT COLUMN (5/12): Net Worth + Chart + Accounts ── */}
            <div className="lg:col-span-5 space-y-4">
              {/* Net Worth Hero */}
              <div className="rounded-3xl bg-gradient-to-br from-white/80 to-white/40 dark:from-slate-900/80 dark:to-slate-900/40 p-6 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="page-section-label">Patrimonio neto</p>
                    <p className="text-[34px] font-bold leading-none tracking-tight tabular-nums mt-1"><AnimatedMoney value={netWorth} /></p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${netWorthDelta >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                    {netWorthDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    <Sensitive>{signedMoney(netWorthDelta)}</Sensitive>
                  </span>
                </div>
                {netWorthHasData ? (
                  <LineChart data={netWorthTrend} index="mes" categories={["patrimonio"]} colors={["emerald"]} valueFormatter={chartFormatter} yAxisWidth={56} className="h-[180px]" showAnimation />
                ) : (
                  <div className="flex h-[180px] items-center justify-center rounded-2xl bg-muted/30"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
              </div>

              {/* My Cards (accounts) */}
              <div className="rounded-3xl bg-white/70 dark:bg-slate-900/70 p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Wallet className="h-4 w-4 text-muted-foreground" />Mis cuentas</h3>
                  <button onClick={() => setShowNewAccount(true)} className="text-xs font-medium text-primary hover:underline">+ Nueva</button>
                </div>
                {topAccounts.length === 0 ? (
                  <button onClick={() => setShowNewAccount(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 p-5 text-sm text-muted-foreground transition-all hover:border-muted-foreground/50 hover:text-foreground"><Plus className="h-4 w-4" />Añadir cuenta</button>
                ) : (
                  <div className="space-y-2">
                    {topAccounts.map((account) => {
                      const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                      const I = cfg.icon
                      return (
                        <button key={account.id} onClick={() => router.push(`/cuentas/${account.id}`)} className="flex w-full items-center justify-between gap-3 rounded-2xl bg-muted/20 p-3 text-left transition-all hover:bg-muted/40 hover:-translate-y-0.5">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-primary/5"><I className="h-4 w-4" style={{ color: cfg.color }} /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{account.nombre}</span>
                              <span className="block text-[11px] text-muted-foreground">{cfg.label}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums"><Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── CENTER COLUMN (4/12): Spending + Banner ── */}
            <div className="lg:col-span-4 space-y-4">
              {/* Spending chart */}
              <div className="rounded-3xl bg-white/70 dark:bg-slate-900/70 p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><CircleDollarSign className="h-4 w-4 text-blue-500" />Movimiento mensual</h3>
                  <span className="text-[11px] text-muted-foreground">Ingresos vs Gastos</span>
                </div>
                {netWorthHasData ? (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-2xl bg-emerald-500/5 p-3 ring-1 ring-emerald-500/10">
                      <p className="text-[11px] text-emerald-500 font-semibold">+<AnimatedMoney value={monthTotals.ingresos} /></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos</p>
                    </div>
                    <div className="rounded-2xl bg-red-500/5 p-3 ring-1 ring-red-500/10">
                      <p className="text-[11px] text-red-500 font-semibold">-<AnimatedMoney value={monthTotals.gastos} /></p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Gastos</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[100px] items-center justify-center rounded-2xl bg-muted/30 mb-4"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
                {assetDistribution.length > 0 && (
                  <div className="rounded-2xl bg-muted/20 p-3">
                    <p className="text-[11px] font-semibold text-muted-foreground mb-2">Distribución</p>
                    <DonutChart data={assetDistribution} category="value" index="name" variant="donut" className="mx-auto h-28 w-28" showAnimation />
                    <div className="mt-2 space-y-1">
                      {assetDistribution.slice(0, 3).map((a) => {
                        const cur = displayAccounts.find((ac) => ac.nombre === a.name)?.currency ?? "EUR"
                        return (
                          <div key={a.name} className="flex items-center justify-between text-[10px]">
                            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: a.color }} />{a.name}</span>
                            <Sensitive as="span" className="tabular-nums font-medium">{formatMoney(a.value, cur)}</Sensitive>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Management banner */}
              <div className="rounded-3xl bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-violet-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-violet-500/10 p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Regla 50/30/20</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">Distribuye tus ingresos: 50% necesidades, 30% deseos, 20% ahorro. {savingsRate >= 20 ? "¡Vas por buen camino!" : "Intenta ahorrar al menos el 20%."}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RIGHT COLUMN (3/12): Transactions + Score ── */}
            <div className="lg:col-span-3 space-y-4">
              {/* Recent transactions feed */}
              <div className="rounded-3xl bg-white/70 dark:bg-slate-900/70 p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />Últimos</h3>
                  <Link href="/transactions" className="text-[11px] font-medium text-primary hover:underline">Ver todo</Link>
                </div>
                {recentTransactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <Activity className="h-6 w-6 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Sin movimientos</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {recentTransactions.map((t) => {
                      const account = state.accounts.find((a) => a.id === t.cuenta_id)
                      return (
                        <div key={t.id} className="flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-muted/20">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${t.tipo === "ingreso" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                            {t.tipo === "ingreso" ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{t.descripcion || t.categoria}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{new Date(t.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · {account?.nombre ?? ""}</p>
                          </div>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${t.tipo === "ingreso" ? "text-emerald-500" : "text-red-500"}`}>
                            <Sensitive>{t.tipo === "ingreso" ? "+" : "-"}{t.monto.toLocaleString("es-ES")}€</Sensitive>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Credit Score / Savings Rate */}
              <div className="rounded-3xl bg-white/70 dark:bg-slate-900/70 p-5 ring-1 ring-black/5 dark:ring-white/10 shadow-sm backdrop-blur-xl text-center">
                <p className="page-section-label mb-3">Tasa de ahorro</p>
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - Math.min(savingsRate, 100) / 100)}`} className="text-emerald-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
                  </svg>
                  <span className="absolute text-2xl font-bold tabular-nums tracking-tight text-emerald-500">{savingsRate}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{savingsRate >= 20 ? "Objetivo 20% alcanzado 🎯" : `Meta: 20% · ${20 - savingsRate}% restante`}</p>
              </div>
            </div>
          </div>

          {/* ── Bottom: full width tables ── */}
          <div className="space-y-1">
            <p className="page-section-label">Operativo</p>
            <h2 className="text-xl font-bold tracking-tight">Historial y metas</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">Transacciones completas y fondos de ahorro con filtros, exportación y edición.</p>
          </div>

          <TransactionsTable selectedMonth={selectedMonth} />
          <SinkingFundsGrid />

          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      )}
    </div>
  )
}
