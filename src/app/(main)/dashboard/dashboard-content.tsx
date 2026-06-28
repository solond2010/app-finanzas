"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AreaChart, DonutChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Eye, EyeOff, Plus, Sparkles, Target, Wallet } from "lucide-react"

import { AccountDialog } from "@/components/dashboard/account-dialog"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { getAccountsAtMonth, getMonthTotalsByString, getNetWorthAtMonth, getCategoryBreakdown } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { usePrivacy } from "@/lib/privacy"

import { memo } from "react"

const SectionTitle = memo(function SectionTitle({ label, title, text }: { label: string; title: string; text?: string }) {
  return (
    <div className="col-span-full flex flex-col gap-1 pt-2">
      <p className="page-section-label">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
        {text && <p className="max-w-xl text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
  )
})

const MetricCard = memo(function MetricCard({
  label, value, subtitle, icon: Icon, tone, delay,
}: {
  label: string; value: React.ReactNode; subtitle: string; icon: React.ElementType; tone: "emerald" | "red" | "blue" | "amber" | "violet"; delay: number
}) {
  const tones: Record<string, string> = {
    emerald: "from-emerald-500/12 to-emerald-500/[0.02] text-emerald-500 ring-emerald-500/15",
    red: "from-red-500/12 to-red-500/[0.02] text-red-500 ring-red-500/15",
    blue: "from-blue-500/12 to-blue-500/[0.02] text-blue-500 ring-blue-500/15",
    amber: "from-amber-500/12 to-amber-500/[0.02] text-amber-500 ring-amber-500/15",
    violet: "from-violet-500/12 to-violet-500/[0.02] text-violet-500 ring-violet-500/15",
  }
  return (
    <div className="stagger-fade glass-card rounded-[24px] p-5 card-glow glass-card-hover" style={{ animationDelay: `${delay}ms` }}>
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]} opacity-75 rounded-[24px]`} />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <p className="page-section-label">{label}</p>
          <div className={`rounded-2xl bg-background/60 p-2.5 ring-1 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums sm:text-[32px] text-foreground">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  )
})

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[24px] ${className ?? ""}`} />
}

export default function DashboardContent() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [showNewAccount, setShowNewAccount] = useState(false)

  const selectedDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1), [today, monthOffset])
  const previousDate = useMemo(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1), [selectedDate])
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const previousTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, previousMonth), [analysisTransactions, previousMonth])
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const previousNetWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, previousMonth), [state.accounts, state.transactions, previousMonth])

  const netWorthDelta = netWorth - previousNetWorth
  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0
  const expenseDelta = previousTotals.gastos > 0 ? Math.round(((monthTotals.gastos - previousTotals.gastos) / previousTotals.gastos) * 100) : 0
  const cashflow = monthTotals.ingresos - monthTotals.gastos

  const safeTime = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? 0 : d.getTime() }

  const recentTransactions = useMemo(
    () => analysisTransactions
      .filter((t) => t.fecha.startsWith(selectedMonth))
      .sort((a, b) => safeTime(b.fecha) - safeTime(a.fecha))
      .slice(0, 5),
    [analysisTransactions, selectedMonth]
  )

  const topAccounts = useMemo(() => displayAccounts.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 4), [displayAccounts])

  const netWorthTrend = useMemo(
    () => [-5, -4, -3, -2, -1, 0].map((offset) => {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), patrimonio: getNetWorthAtMonth(state.accounts, state.transactions, key) }
    }),
    [selectedDate, state.accounts, state.transactions]
  )

  const spendingByCategory = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])

  const assetDistribution = useMemo(() => displayAccounts
    .filter((a) => a.saldo !== 0)
    .map((a) => {
      const cfg = typeConfig[a.tipo] ?? typeConfig.efectivo
      return { name: a.nombre, value: Math.abs(a.saldo), color: cfg.color }
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
    <div className="space-y-7">
      {loading ? (
        <div className="space-y-7">
          <Skeleton className="h-56" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : !hasAnyData ? (
        <>
          <section className="hero-gradient relative overflow-hidden rounded-[32px] bg-card/70 p-8 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-14">
            <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
              <div className="rounded-[28px] bg-background/70 p-5 card-elevated">
                <Wallet className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Primer paso</p>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-foreground">Construye tu centro financiero.</h2>
                <p className="max-w-lg text-sm leading-6 text-muted-foreground mx-auto">Crea tu primera cuenta y empieza a registrar movimientos. El dashboard se convertir&aacute; en tu resumen diario de patrimonio, gastos y metas.</p>
              </div>
              <Button size="lg" className="gap-2 rounded-full px-6 shadow-lg shadow-primary/25" onClick={() => setShowNewAccount(true)}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
            </div>
          </section>
          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      ) : (
        <>
          {/* ── Hero section ── */}
          <section className="relative overflow-hidden rounded-[32px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.14),transparent_30%)] dark:bg-[radial-gradient(circle_at_10%_20%,rgba(16,185,129,0.28),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.24),transparent_30%)]" />
            <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  Panel de control
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Resumen financiero</p>
                  <h1 className="max-w-3xl text-[34px] font-bold leading-[0.95] tracking-tight sm:text-[44px] lg:text-[52px] text-foreground">Tu patrimonio, en perspectiva.</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Visión general de tus cuentas, ingresos, gastos y evolución patrimonial mes a mes.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-2xl bg-background/70 px-3 py-2 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
                <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[165px] text-center text-sm font-bold capitalize tracking-tight text-foreground">{formatMonth(selectedDate)}</span>
                <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="mx-1 h-6 w-px bg-border/50" />
                <button onClick={togglePrivacy} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label={privacy ? "Desactivar modo privacidad" : "Activar modo privacidad"}>
                  {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </section>

          {/* ── Snapshot metrics ── */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Ingresos" value={<><AnimatedNumber value={monthTotals.ingresos} prefix="+" /></>} subtitle="Entradas del mes" icon={ArrowUpRight} tone="emerald" delay={0} />
            <MetricCard label="Gastos" value={<><AnimatedNumber value={monthTotals.gastos} prefix="-" /></>} subtitle={previousTotals.gastos > 0 ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% vs mes anterior` : "Sin comparativa"} icon={ArrowDownRight} tone="red" delay={80} />
            <MetricCard label="Cash flow" value={<AnimatedNumber value={cashflow} />} subtitle={cashflow >= 0 ? "Flujo de caja positivo" : "Flujo de caja negativo"} icon={CircleDollarSign} tone={cashflow >= 0 ? "blue" : "amber"} delay={160} />
            <MetricCard label="Ahorro" value={`${savingsRate}%`} subtitle={savingsRate >= 20 ? "Objetivo 20% alcanzado" : savingsRate > 0 ? "Meta: 20%" : "Sin ahorro este mes"} icon={Target} tone={savingsRate >= 20 ? "emerald" : savingsRate > 0 ? "amber" : "red"} delay={240} />
          </section>

          {/* ── Patrimonio + evolución ── */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">

              {/* Net worth + chart */}
              <div className="glass-card rounded-[24px] p-6 card-glow">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <p className="page-section-label">Patrimonio neto</p>
                    <p className="text-[34px] font-bold leading-none tracking-tight tabular-nums text-foreground">
                      <AnimatedNumber value={netWorth} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {netWorthDelta >= 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-500 font-semibold"><ArrowUpRight className="h-3 w-3" /><Sensitive>{Math.abs(netWorthDelta).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</Sensitive></span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-500 font-semibold"><ArrowDownRight className="h-3 w-3" /><Sensitive>{Math.abs(netWorthDelta).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</Sensitive></span>
                      )}
                      <span className="ml-1">vs mes anterior</span>
                    </p>
                  </div>
                  <Link href="/analytics" className="shrink-0 rounded-2xl bg-background/60 p-2.5 ring-1 ring-border/20 hover:ring-border/40 transition-all">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </div>
                {netWorthHasData ? (
                  <AreaChart
                    data={netWorthTrend}
                    index="mes"
                    categories={["patrimonio"]}
                    colors={["emerald"]}
                    valueFormatter={chartFormatter}
                    showLegend={false}
                    className="h-[220px] -mx-1"
                    curveType="monotone"
                    showAnimation
                  />
                ) : (
                  <div className="flex h-[220px] items-center justify-center rounded-2xl bg-muted/30"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
              </div>

              {/* Cuentas */}
              <div className="glass-card rounded-[24px] p-6 card-glow">
                <div className="flex items-center justify-between mb-4">
                  <p className="page-section-label">Mis cuentas</p>
                  <button onClick={() => setShowNewAccount(true)} className="text-xs font-medium text-primary hover:underline">+ Nueva</button>
                </div>
                {topAccounts.length === 0 ? (
                  <button onClick={() => setShowNewAccount(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/25 p-5 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"><Plus className="h-4 w-4" />Añadir cuenta</button>
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
                              <span className="block truncate text-sm font-semibold text-foreground">{account.nombre}</span>
                              <span className="block text-[11px] text-muted-foreground">{cfg.label}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-bold tabular-nums text-foreground"><Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column ── */}
            <div className="space-y-6">

              {/* Ingresos vs gastos del mes */}
              <div className="glass-card rounded-[24px] p-6 card-glow">
                <div className="flex items-center justify-between mb-4">
                  <p className="page-section-label">Movimiento mensual</p>
                  <span className="text-[11px] text-muted-foreground">{formatMonth(selectedDate)}</span>
                </div>
                {monthTotals.ingresos > 0 || monthTotals.gastos > 0 ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-emerald-500/5 p-3 ring-1 ring-emerald-500/10">
                        <p className="page-section-label">Ingresos</p>
                        <p className="text-lg font-bold tabular-nums text-emerald-500 mt-1">+<AnimatedNumber value={monthTotals.ingresos} /></p>
                      </div>
                      <div className="rounded-2xl bg-red-500/5 p-3 ring-1 ring-red-500/10">
                        <p className="page-section-label">Gastos</p>
                        <p className="text-lg font-bold tabular-nums text-red-500 mt-1">-<AnimatedNumber value={monthTotals.gastos} /></p>
                      </div>
                    </div>
                    <DonutChart
                      data={[
                        { name: "Ingresos", value: Math.max(monthTotals.ingresos, 1) },
                        { name: "Gastos", value: Math.max(monthTotals.gastos, 1) },
                      ]}
                      category="value"
                      index="name"
                      variant="donut"
                      className="h-28 mx-auto"
                      showAnimation
                      colors={["emerald", "red"]}
                    />
                  </div>
                ) : (
                  <div className="flex h-[200px] items-center justify-center rounded-2xl bg-muted/30"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
              </div>

              {/* Top categorías de gasto */}
              {spendingByCategory.length > 0 && (
                <div className="glass-card rounded-[24px] p-6 card-glow">
                  <p className="page-section-label mb-3">Gastos por categoría</p>
                  <div className="space-y-2.5">
                    {spendingByCategory.slice(0, 5).map((cat) => (
                      <div key={cat.categoria} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{cat.categoria}</span>
                        <span className="font-semibold tabular-nums text-foreground"><Sensitive>{cat.monto.toLocaleString("es-ES")}€</Sensitive></span>
                      </div>
                    ))}
                    {spendingByCategory.length > 5 && (
                      <Link href="/analytics" className="block text-center text-xs font-medium text-primary hover:underline pt-1">Ver todas las categorías</Link>
                    )}
                  </div>
                </div>
              )}

              {/* Tasa de ahorro */}
              <div className="glass-card rounded-[24px] p-6 card-glow text-center">
                <div className="flex items-center justify-between mb-2">
                  <p className="page-section-label">Tasa de ahorro</p>
                  <Link href="/objetivos" className="text-xs font-medium text-primary hover:underline">Objetivos</Link>
                </div>
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 52}`}
                      strokeDashoffset={`${2 * Math.PI * 52 * (1 - Math.min(savingsRate, 100) / 100)}`}
                      className={savingsRate >= 20 ? "text-emerald-500" : savingsRate > 0 ? "text-amber-500" : "text-red-500"}
                      style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
                    />
                  </svg>
                  <span className="absolute text-2xl font-bold tabular-nums tracking-tight" style={{ color: savingsRate >= 20 ? "#10b981" : savingsRate > 0 ? "#f59e0b" : "#ef4444" }}>{savingsRate}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{savingsRate >= 20 ? "Meta de ahorro alcanzada 🎯" : savingsRate > 0 ? "Te recomendamos ahorrar al menos el 20%" : "Sin ahorro este mes"}</p>
              </div>
            </div>
          </section>

          {/* ── Últimos movimientos ── */}
          <section className="space-y-4">
            <SectionTitle label="Actividad reciente" title="Últimos movimientos" text="Tus transacciones más recientes del mes." />
            {recentTransactions.length === 0 ? (
              <div className="glass-card rounded-[24px] p-8 card-glow text-center">
                <div className="flex flex-col items-center gap-3 py-6">
                  <div className="rounded-2xl bg-background/60 p-3 ring-1 ring-border/20">
                    <Activity className="h-6 w-6 text-muted-foreground/45" />
                  </div>
                  <p className="text-sm text-muted-foreground">Sin movimientos este mes</p>
                </div>
              </div>
            ) : (
              <div className="glass-card rounded-[24px] card-glow overflow-hidden">
                <div className="divide-y divide-border/30">
                  {recentTransactions.map((t) => {
                    const account = state.accounts.find((a) => a.id === t.cuenta_id)
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/20">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.tipo === "ingreso" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                          {t.tipo === "ingreso" ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{t.descripcion || t.categoria}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{new Date(t.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })} · {account?.nombre ?? ""}</p>
                        </div>
                        <span className={`shrink-0 text-sm font-bold tabular-nums ${t.tipo === "ingreso" ? "text-emerald-500" : "text-foreground"}`}>
                          <Sensitive>{t.tipo === "ingreso" ? "+" : "-"}{formatMoney(t.monto, "EUR")}</Sensitive>
                        </span>
                      </div>
                    )
                  })}
                </div>
                <Link href="/transactions" className="flex items-center justify-center gap-1.5 border-t border-border/30 px-5 py-3 text-xs font-medium text-primary transition-colors hover:bg-muted/20">
                  Ver todas las transacciones
                </Link>
              </div>
            )}
          </section>

          {/* ── Full width tables ── */}
          <TransactionsTable selectedMonth={selectedMonth} />
          <SinkingFundsGrid />

          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      )}
    </div>
  )
}