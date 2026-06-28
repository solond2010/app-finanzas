"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AreaChart, DonutChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Eye, EyeOff, Plus, Target, Wallet } from "lucide-react"

import { AccountDialog } from "@/components/dashboard/account-dialog"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getAccountsAtMonth, getMonthTotalsByString, getNetWorthAtMonth } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { AnimatedNumber as AnimatedMoney } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { usePrivacy } from "@/lib/privacy"
import { cn } from "@/lib/utils"

import { memo } from "react"

const card = "rounded-2xl bg-white dark:bg-slate-900 shadow-sm ring-1 ring-black/5 dark:ring-white/10"

const SnapshotCard = memo(function SnapshotCard({ label, value, subtitle, icon: Icon, color, delay }: { label: string; value: React.ReactNode; subtitle: string; icon: React.ElementType; color: string; delay: number }) {
  return (
    <div className="stagger-fade rounded-2xl bg-white dark:bg-slate-900 p-4 ring-1 ring-black/5 dark:ring-white/10 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50">
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="text-xl font-bold leading-none tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
    </div>
  )
})

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-muted ${className ?? ""}`} />
}

export default function DashboardPage() {
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
    <div className="max-w-[1400px] mx-auto pb-12 space-y-6">
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-16" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-80 lg:col-span-2" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : !hasAnyData ? (
        <>
          <div className={cn(card, "flex flex-col items-center justify-center gap-6 p-12 sm:p-20 text-center")}>
            <div className="rounded-2xl bg-muted p-5">
              <Wallet className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <div className="max-w-md space-y-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Primer paso</p>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">Construye tu centro financiero</h2>
              <p className="text-sm text-muted-foreground">Crea tu primera cuenta y empieza a registrar movimientos. Tu dashboard se convertir&aacute; en tu resumen financiero diario.</p>
            </div>
            <Button size="lg" className="rounded-full px-8 gap-2" onClick={() => setShowNewAccount(true)}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
          </div>
          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      ) : (
        <>
          {/* ── Header: greeting + month nav + privacy ── */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Resumen financiero</h1>
              <p className="text-sm text-muted-foreground">{formatMonth(selectedDate)}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-xl bg-muted p-0.5">
                <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-[80px] text-center text-xs font-semibold text-foreground">{formatMonth(selectedDate)}</span>
                <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><ChevronRight className="h-4 w-4" /></button>
              </div>
              <button onClick={togglePrivacy} className="rounded-xl p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* ── Snapshot metrics ── */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SnapshotCard label="Ingresos" value={<AnimatedMoney value={monthTotals.ingresos} prefix="+" />} subtitle="Entradas del mes" icon={ArrowUpRight} color="#10b981" delay={0} />
            <SnapshotCard label="Gastos" value={<AnimatedMoney value={monthTotals.gastos} prefix="-" />} subtitle={previousTotals.gastos > 0 ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% vs mes ant.` : "Sin comparativa"} icon={ArrowDownRight} color="#ef4444" delay={80} />
            <SnapshotCard label="Cash Flow" value={<AnimatedMoney value={cashflow} />} subtitle={cashflow >= 0 ? "Flujo positivo" : "Flujo negativo"} icon={CircleDollarSign} color={cashflow >= 0 ? "#3b82f6" : "#f59e0b"} delay={160} />
            <SnapshotCard label="Ahorro" value={`${savingsRate}%`} subtitle={savingsRate >= 20 ? "Meta 20% alcanzada" : savingsRate > 0 ? "Meta: 20%" : "Sin ahorro"} icon={Target} color={savingsRate >= 20 ? "#10b981" : "#f59e0b"} delay={240} />
          </div>

          {/* ── Main grid: 2 columns ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── LEFT SPAN 2: Net worth hero + chart + accounts ── */}
            <div className="lg:col-span-2 space-y-6">

              {/* Net Worth + Chart combined */}
              <div className={cn(card, "p-6")}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Patrimonio neto</p>
                    <p className="text-3xl font-bold tracking-tight tabular-nums text-foreground mt-0.5">
                      <AnimatedMoney value={netWorth} />
                    </p>
                  </div>
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    netWorthDelta >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"
                  )}>
                    {netWorthDelta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    <Sensitive>{Math.abs(netWorthDelta).toLocaleString("es-ES", { style: "currency", currency: "EUR" })}</Sensitive>
                  </span>
                </div>
                {netWorthHasData ? (
                  <AreaChart
                    data={netWorthTrend}
                    index="mes"
                    categories={["patrimonio"]}
                    colors={["blue"]}
                    valueFormatter={chartFormatter}
                    showLegend={false}
                    className="h-[200px] -mx-1"
                    curveType="monotone"
                    showAnimation
                  />
                ) : (
                  <div className="flex h-[200px] items-center justify-center rounded-xl bg-muted/50"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
              </div>

              {/* Accounts list */}
              <div className={cn(card, "p-6")}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Cuentas</h3>
                  <button onClick={() => setShowNewAccount(true)} className="text-xs font-medium text-primary hover:underline">+ Añadir</button>
                </div>
                {topAccounts.length === 0 ? (
                  <button onClick={() => setShowNewAccount(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-muted-foreground/25 p-5 text-sm text-muted-foreground hover:border-muted-foreground/50 transition-colors"><Plus className="h-4 w-4" />Crear cuenta</button>
                ) : (
                  <div className="space-y-1.5">
                    {topAccounts.map((a) => {
                      const cfg = typeConfig[a.tipo] ?? typeConfig.efectivo
                      const I = cfg.icon
                      return (
                        <button key={a.id} onClick={() => router.push(`/cuentas/${a.id}`)} className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/30 px-3.5 py-3 text-left transition-all hover:bg-muted/60">
                          <span className="flex items-center gap-3 min-w-0">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm"><I className="h-4 w-4" style={{ color: cfg.color }} /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">{a.nombre}</span>
                              <span className="block text-[11px] text-muted-foreground">{cfg.label} &middot; {a.currency}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground"><Sensitive>{formatMoney(a.saldo, a.currency)}</Sensitive></span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── RIGHT SPAN 1: Spend breakdown + recent txs + savings rate ── */}
            <div className="space-y-6">

              {/* Ingresos vs Gastos donut */}
              <div className={cn(card, "p-6")}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">Mes actual</h3>
                  <span className="text-[11px] text-muted-foreground">{formatMonth(selectedDate)}</span>
                </div>
                {monthTotals.ingresos > 0 || monthTotals.gastos > 0 ? (
                  <div className="space-y-4">
                    <DonutChart
                      data={[
                        { name: "Ingresos", value: monthTotals.ingresos },
                        { name: "Gastos", value: monthTotals.gastos },
                      ]}
                      category="value"
                      index="name"
                      variant="donut"
                      className="h-32 mx-auto"
                      showAnimation
                      colors={["emerald", "red"]}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-emerald-500/5 p-3 text-center ring-1 ring-emerald-500/10">
                        <p className="text-sm font-bold text-emerald-500 tabular-nums"><AnimatedMoney value={monthTotals.ingresos} /></p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Ingresos</p>
                      </div>
                      <div className="rounded-xl bg-red-500/5 p-3 text-center ring-1 ring-red-500/10">
                        <p className="text-sm font-bold text-red-500 tabular-nums"><AnimatedMoney value={monthTotals.gastos} /></p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Gastos</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-[200px] items-center justify-center rounded-xl bg-muted/50"><BarChart3 className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
              </div>

              {/* Tasa de ahorro circular */}
              <div className={cn(card, "p-6 text-center")}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Tasa de ahorro</h3>
                  <Link href="/objetivos" className="text-[11px] font-medium text-primary hover:underline">Objetivos</Link>
                </div>
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - Math.min(savingsRate, 100) / 100)}`}
                      className={savingsRate >= 20 ? "text-emerald-500" : savingsRate > 0 ? "text-amber-400" : "text-red-400"}
                      style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
                    />
                  </svg>
                  <span className="absolute text-xl font-bold tabular-nums tracking-tight text-foreground">{savingsRate}%</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-3">{savingsRate >= 20 ? "Objetivo 20% alcanzado" : "Meta: 20% de ahorro"}</p>
              </div>

              {/* Recent transactions */}
              <div className={cn(card, "p-6")}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Últimos movimientos</h3>
                  <Link href="/transactions" className="text-[11px] font-medium text-primary hover:underline">Ver todo</Link>
                </div>
                {recentTransactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <Activity className="h-6 w-6 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Sin movimientos este mes</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentTransactions.map((t) => {
                      const account = state.accounts.find((a) => a.id === t.cuenta_id)
                      return (
                        <div key={t.id} className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/40">
                          <span className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                            t.tipo === "ingreso" ? "bg-emerald-500/10" : "bg-red-500/10"
                          )}>
                            {t.tipo === "ingreso" ? <ArrowUpRight className="h-4 w-4 text-emerald-500" /> : <ArrowDownRight className="h-4 w-4 text-red-500" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{t.descripcion || t.categoria}</p>
                            <p className="truncate text-[11px] text-muted-foreground">{new Date(t.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} &middot; {account?.nombre ?? ""}</p>
                          </div>
                          <span className={cn(
                            "shrink-0 text-sm font-semibold tabular-nums",
                            t.tipo === "ingreso" ? "text-emerald-500" : "text-foreground"
                          )}>
                            <Sensitive>{t.tipo === "ingreso" ? "+" : "-"}{formatMoney(t.monto, "EUR")}</Sensitive>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Full-width tables ── */}
          <div className={cn(card, "p-6")}>
            <TransactionsTable selectedMonth={selectedMonth} />
          </div>
          <div className={cn(card, "p-6")}>
            <SinkingFundsGrid />
          </div>

          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      )}
    </div>
  )
}