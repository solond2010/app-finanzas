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
    () => state.transactions
      .filter((t) => t.fecha.startsWith(selectedMonth))
      .sort((a, b) => safeTime(b.fecha) - safeTime(a.fecha))
      .slice(0, 5),
    [state.transactions, selectedMonth]
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

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-6 lg:p-8">
      {/* Navbar Flotante */}
      <header className="sticky top-4 z-40 mb-8 flex items-center justify-between rounded-full bg-white/80 px-6 py-3 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07)] ring-1 ring-slate-100 backdrop-blur-md dark:bg-slate-900/80 dark:ring-slate-800">
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">Mohamed Amin</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-full p-2 text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></button>
            <span className="w-32 text-center text-sm font-medium capitalize text-slate-900 dark:text-white">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-full p-2 text-slate-600 hover:bg-white hover:shadow-sm dark:text-slate-400 dark:hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={togglePrivacy} className="rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">
            {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-96" />
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bienvenido, Mohamed</h2>
          <p className="mt-2 text-slate-500">Comienza configurando tu primera cuenta.</p>
          <Button onClick={() => setShowNewAccount(true)} className="mt-6 rounded-full px-6">Crear cuenta</Button>
        </div>
      ) : (
        <main className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Métricas (4 en fila) */}
          <section className="col-span-1 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard label="Balance Total" value={<AnimatedNumber value={netWorth} prefix="€" />} subtitle="Patrimonio neto actual" icon={Wallet} tone="blue" delay={0} />
            <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix="+" />} subtitle="Este mes" icon={ArrowUpRight} tone="emerald" delay={80} />
            <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix="-" />} subtitle="Este mes" icon={ArrowDownRight} tone="red" delay={160} />
            <MetricCard label="Tasa de Ahorro" value={`${savingsRate}%`} subtitle="Objetivo del 20%" icon={Target} tone="blue" delay={240} />
          </section>
          
                  <main className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Métricas (4 en fila) */}
          <section className="col-span-1 lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Balance Total" value={<AnimatedNumber value={netWorth} prefix="€" />} subtitle="Patrimonio neto actual" icon={Wallet} tone="blue" delay={0} />
            <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix="+" />} subtitle="Este mes" icon={ArrowUpRight} tone="emerald" delay={80} />
            <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix="-" />} subtitle="Este mes" icon={ArrowDownRight} tone="red" delay={160} />
            <MetricCard label="Tasa de Ahorro" value={`${savingsRate}%`} subtitle="Objetivo del 20%" icon={Target} tone="blue" delay={240} />
          </section>
          
          {/* Bento Grid Principal */}
          <section className="col-span-1 lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Net worth + chart (Main Bento) */}
            <div className="md:col-span-2 rounded-[24px] bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
               <div className="flex items-start justify-between gap-4 mb-6">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Patrimonio neto</p>
                    <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
                      <AnimatedNumber value={netWorth} prefix="€" />
                    </p>
                  </div>
                  <Link href="/analytics" className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                </div>
                {netWorthHasData ? (
                  <AreaChart
                    data={netWorthTrend}
                    index="mes"
                    categories={["patrimonio"]}
                    colors={["blue"]}
                    valueFormatter={chartFormatter}
                    showLegend={false}
                    className="h-[220px]"
                    curveType="monotone"
                    showAnimation
                  />
                ) : (
                  <div className="flex h-[220px] items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800"><BarChart3 className="h-6 w-6 text-slate-300" /></div>
                )}
            </div>

            {/* Cuentas */}
            <div className="md:col-span-2 rounded-[24px] bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Mis cuentas</p>
                <button onClick={() => setShowNewAccount(true)} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">+ Nueva</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {topAccounts.map((account) => {
                  const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                  const I = cfg.icon
                  return (
                    <button key={account.id} onClick={() => router.push(`/cuentas/${account.id}`)} 
                      className="group flex flex-col gap-4 rounded-[20px] bg-slate-50 p-5 transition-all hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-white p-2 dark:bg-slate-900 shadow-sm">
                          <I className="h-4 w-4" style={{ color: cfg.color }} />
                        </div>
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{account.nombre}</span>
                      </div>
                      <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                        <Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive>
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          {/* Columna Derecha */}
          <section className="col-span-1 space-y-6">
            {/* Movimiento mensual */}
            <div className="rounded-[24px] bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Flujo Mensual</p>
                <DonutChart
                      data={[
                        { name: "Ingresos", value: Math.max(monthTotals.ingresos, 1) },
                        { name: "Gastos", value: Math.max(monthTotals.gastos, 1) },
                      ]}
                      category="value"
                      index="name"
                      variant="donut"
                      className="h-40"
                      showAnimation
                      colors={["emerald", "red"]}
                    />
            </div>
            
            {/* Tasa de ahorro */}
            <div className="rounded-[24px] bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 text-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Tasa de ahorro</p>
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-blue-600">{savingsRate}%</span>
                </div>
            </div>
          </section>

// Actualización del componente MetricCard para la nueva estética institucional
const MetricCard = memo(function MetricCard({
  label, value, subtitle, icon: Icon, tone, delay,
}: {
  label: string; value: React.ReactNode; subtitle: string; icon: React.ElementType; tone: "emerald" | "red" | "blue" | "amber" | "violet"; delay: number
}) {
  const tones = {
    emerald: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30",
    red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30",
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
    amber: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
    violet: "text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
  }
  return (
    <div className="rounded-[24px] bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">{value}</p>
        </div>
        <div className={`rounded-full p-2 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{subtitle}</p>
    </div>
  )
})
