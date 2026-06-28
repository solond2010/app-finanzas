"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AreaChart, DonutChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Eye, EyeOff, Plus, Sparkles, Target, TrendingUp, Wallet, Search, Settings } from "lucide-react"

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
    <div className="rounded-[28px] bg-white dark:bg-slate-900 p-5 ring-1 ring-slate-100 dark:ring-slate-800 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-slate-50 dark:bg-slate-800">
          <Icon className="h-5 w-5" style={{ color }} />
        </span>
      </div>
      <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white" style={{ color }}>{value}</p>
      <p className="mt-2 text-[12px] text-slate-400 dark:text-slate-500">{subtitle}</p>
    </div>
  )
})

const EmptyWelcome = memo(function EmptyWelcome({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="hero-gradient rounded-[36px] bg-white dark:bg-slate-900 p-8 text-center sm:p-14 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-6">
        <div className="relative">
          <div className="rounded-[28px] bg-slate-50 dark:bg-slate-800 p-6 shadow-sm">
            <div className="relative">
              <Wallet className="h-14 w-14 text-slate-400" />
              <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#3b82f6] text-[10px] font-bold text-white shadow-lg shadow-blue-500/30">
                <Sparkles className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#3b82f6]">Primer paso</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-slate-900 dark:text-white">Construye tu centro financiero.</h2>
          <p className="max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400 mx-auto">Crea tu primera cuenta y empieza a registrar movimientos. El dashboard se convertirá en tu resumen diario de patrimonio, gastos y metas.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" className="gap-2 rounded-full px-6 bg-[#3b82f6] hover:bg-blue-600 text-white shadow-lg shadow-blue-500/25" onClick={onCreateAccount}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
        </div>
      </div>
    </div>
  )
})

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-[32px] bg-slate-100 dark:bg-slate-800 ${className ?? ""}`} />
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
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12 font-sans">
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-20 rounded-full" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <Skeleton className="h-96 lg:col-span-5" />
            <Skeleton className="h-96 lg:col-span-4" />
            <Skeleton className="h-96 lg:col-span-3" />
          </div>
        </div>
      ) : !hasAnyData ? (
        <>
          <EmptyWelcome onCreateAccount={() => setShowNewAccount(true)} />
          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      ) : (
        <>
          {/* ── Floating Navbar (Bankio Style) ── */}
          <div className="flex items-center justify-between rounded-full bg-white dark:bg-slate-900 px-6 py-4 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[#3b82f6]">
                <TrendingUp className="h-5 w-5" />
              </div>
              <span className="text-lg font-bold text-slate-900 dark:text-white mr-8">Bankio</span>
              
              <nav className="hidden md:flex items-center gap-6">
                {["All", "Transactions", "Analytic", "Expenses", "Spending"].map((tab, i) => (
                  <span key={tab} className={`text-sm font-medium cursor-pointer transition-colors ${i === 0 ? "text-slate-900 dark:text-white" : "text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}>
                    {tab}
                  </span>
                ))}
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-50 dark:bg-slate-800 px-4 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input type="text" placeholder="Search" className="bg-transparent text-sm outline-none w-24 text-slate-600 dark:text-slate-200" />
              </div>
              
              <div className="flex items-center gap-1 rounded-full bg-slate-50 dark:bg-slate-800 p-1">
                <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-full p-1.5 text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"><ChevronLeft className="h-4 w-4" /></button>
                <span className="min-w-[90px] text-center text-xs font-bold capitalize text-slate-700 dark:text-slate-200">{formatMonth(selectedDate)}</span>
                <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-full p-1.5 text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all"><ChevronRight className="h-4 w-4" /></button>
              </div>

              <button onClick={togglePrivacy} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                {privacy ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
              <button className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* ── Snapshot metrics row ── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SnapshotCard label="INGRESOS" value={<AnimatedMoney value={monthTotals.ingresos} prefix="+" />} subtitle="Entradas del mes" icon={ArrowUpRight} color="#10b981" delay={0} />
            <SnapshotCard label="GASTOS" value={<AnimatedMoney value={monthTotals.gastos} prefix="-" />} subtitle={previousTotals.gastos > 0 ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% vs anterior` : "Sin comparativa"} icon={ArrowDownRight} color="#ef4444" delay={80} />
            <SnapshotCard label="NETO DEL MES" value={<AnimatedMoney value={monthTotals.neto} />} subtitle={monthTotals.neto >= 0 ? "Cash flow positivo" : "Cash flow negativo"} icon={CircleDollarSign} color={monthTotals.neto >= 0 ? "#3b82f6" : "#f59e0b"} delay={160} />
            <SnapshotCard label="AHORRO" value={`${savingsRate}%`} subtitle={savingsRate >= 20 ? "Objetivo 20% alcanzado" : savingsRate > 0 ? "Meta: 20%" : "Cash flow negativo"} icon={Target} color={savingsRate >= 20 ? "#10b981" : "#f59e0b"} delay={240} />
          </div>

          {/* ── Bento grid: 3 columns (Bankio Layout) ── */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            
            {/* ── COLUMNA IZQUIERDA (5/12) ── */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Total Balance Card */}
              <div className="rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Total Balance</p>
                <div className="flex items-start justify-between">
                  <p className="text-[44px] font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
                    <AnimatedMoney value={netWorth} />
                  </p>
                </div>
                <div className="mt-8 flex gap-4">
                  <button onClick={() => setShowNewAccount(true)} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent py-3.5 text-sm font-semibold text-slate-900 dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                    <ArrowUpRight className="h-4 w-4" /> Send
                  </button>
                  <button className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-transparent py-3.5 text-sm font-semibold text-slate-900 dark:text-white transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                    <ArrowDownRight className="h-4 w-4" /> Receive
                  </button>
                </div>
              </div>

              {/* My Cards Visuals */}
              <div className="rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">My cards</h3>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2 snap-x">
                  {topAccounts.length === 0 ? (
                    <button onClick={() => setShowNewAccount(true)} className="w-full rounded-[24px] border-2 border-dashed border-slate-200 dark:border-slate-700 p-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex justify-center items-center gap-2">
                      <Plus className="h-5 w-5" /> Añadir cuenta
                    </button>
                  ) : (
                    <>
                      {topAccounts.slice(0, 2).map((account, i) => {
                        const bgClass = i === 0 
                          ? "bg-[#c2d3ff] text-slate-800" 
                          : "bg-[#c1e8d9] text-emerald-900";
                        return (
                          <div key={account.id} className={`min-w-[220px] rounded-[24px] p-5 flex flex-col justify-between aspect-[1.6/1] ${bgClass} relative overflow-hidden snap-center cursor-pointer transition-transform hover:-translate-y-1`} onClick={() => router.push(`/cuentas/${account.id}`)}>
                            <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border border-black/10" />
                            <div className="absolute -right-16 -bottom-16 w-48 h-48 rounded-full border border-black/5" />
                            <div className="flex justify-between items-start z-10">
                              <div className="h-6 w-8 rounded bg-white/40 flex items-center justify-center">
                                <span className="h-3 w-3 rounded-full bg-black/20" />
                              </div>
                              <span className="font-bold text-sm opacity-80 uppercase tracking-widest">{account.tipo}</span>
                            </div>
                            <div className="z-10 mt-auto">
                              <p className="font-mono text-lg tracking-widest opacity-90 mb-1">**** **** {account.id.substring(0,4)}</p>
                              <div className="flex justify-between items-end">
                                <span className="font-semibold text-sm truncate max-w-[100px]">{account.nombre}</span>
                                <span className="font-bold tabular-nums"><Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive></span>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div onClick={() => setShowNewAccount(true)} className="min-w-[60px] rounded-[24px] bg-slate-900 dark:bg-slate-800 text-white flex items-center justify-center cursor-pointer transition-transform hover:-translate-y-1">
                        <Plus className="h-6 w-6" />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Expenses Area Chart */}
              <div className="rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Expenses</h3>
                  <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300">
                    <Sensitive><AnimatedMoney value={netWorth} /></Sensitive>
                  </div>
                </div>
                {netWorthHasData ? (
                  <AreaChart 
                    data={netWorthTrend} 
                    index="mes" 
                    categories={["patrimonio"]} 
                    colors={["blue"]} 
                    valueFormatter={chartFormatter} 
                    showLegend={false}
                    className="h-[180px] mt-4" 
                    curveType="monotone"
                    showAnimation 
                  />
                ) : (
                  <div className="flex h-[180px] items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800"><BarChart3 className="h-6 w-6 text-slate-300" /></div>
                )}
              </div>
            </div>

            {/* ── COLUMNA CENTRAL (4/12) ── */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Spending Box */}
              <div className="rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Spending</h3>
                  <span className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300">{formatMonth(selectedDate)}</span>
                </div>
                
                {netWorthHasData ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-slate-500 mb-1">Movimiento total</p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white"><AnimatedMoney value={monthTotals.gastos} /></p>
                    </div>
                    {assetDistribution.length > 0 && (
                      <div className="relative h-40">
                        <DonutChart data={assetDistribution} category="value" index="name" variant="donut" className="h-full w-full" showAnimation colors={['blue', 'cyan', 'indigo', 'violet']} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex h-[200px] items-center justify-center"><BarChart3 className="h-6 w-6 text-slate-300" /></div>
                )}
              </div>

              {/* Banner How to manage */}
              <div className="rounded-[32px] bg-[#dcf0e6] dark:bg-emerald-900/30 p-8 shadow-sm relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border border-emerald-500/20" />
                <div className="absolute right-4 bottom-4 w-16 h-16 rounded-full border border-emerald-500/20" />
                
                <h3 className="text-xl font-bold text-emerald-950 dark:text-emerald-100 mb-3 relative z-10 max-w-[200px]">How To Manage Money Well?</h3>
                <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-6 relative z-10">Regla 50/30/20: {savingsRate >= 20 ? "¡Vas perfecto!" : "Intenta llegar al 20%."}</p>
                
                <button className="relative z-10 bg-emerald-500 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-md shadow-emerald-500/30 hover:bg-emerald-600 transition-colors">
                  Learn More
                </button>
              </div>
            </div>

            {/* ── COLUMNA DERECHA (3/12) ── */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Transactions Feed */}
              <div className="rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transactions</h3>
                  <Link href="/transactions" className="text-xs font-medium text-slate-400 hover:text-slate-900 dark:hover:text-white">See All</Link>
                </div>
                
                {recentTransactions.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <Activity className="h-6 w-6 text-slate-200" />
                    <p className="text-xs text-slate-400">Sin movimientos</p>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {recentTransactions.map((t) => {
                      const account = state.accounts.find((a) => a.id === t.cuenta_id)
                      return (
                        <div key={t.id} className="flex items-center justify-between group cursor-pointer">
                          <div className="flex items-center gap-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-100 dark:border-slate-800 text-slate-500 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors">
                              {t.tipo === "ingreso" ? <Activity className="h-4 w-4" /> : <Wallet className="h-4 w-4" />}
                            </span>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white">{t.descripcion || t.categoria}</p>
                              <p className="text-xs text-slate-400 mt-0.5">{new Date(t.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })}</p>
                            </div>
                          </div>
                          <span className={`text-sm font-bold tabular-nums ${t.tipo === "ingreso" ? "text-slate-900 dark:text-white" : "text-slate-500"}`}>
                            <Sensitive>{t.tipo === "ingreso" ? "+" : "-"}{formatMoney(t.monto, "EUR")}</Sensitive>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Credit Score (Gauge) */}
              <div className="rounded-[32px] bg-white dark:bg-slate-900 p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800 text-center">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Credit Score</h3>
                  <span className="text-xs text-slate-400">See More</span>
                </div>
                
                <div className="relative mx-auto mt-6 flex h-28 w-44 items-end justify-center overflow-hidden">
                  <svg viewBox="0 0 100 55" className="absolute bottom-0 w-full">
                    {/* Background Arc */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className="text-slate-100 dark:text-slate-800" />
                    {/* Color Arc (Yellow-Greenish depending on score) */}
                    <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="currentColor" strokeWidth="8" strokeLinecap="round" className={savingsRate >= 20 ? "text-emerald-500" : savingsRate > 0 ? "text-amber-400" : "text-red-400"}
                      strokeDasharray={125.6}
                      strokeDashoffset={125.6 - (125.6 * Math.min(savingsRate, 100) / 100)}
                      style={{ transition: "stroke-dashoffset 1.5s ease-out" }}
                    />
                  </svg>
                  <div className="flex flex-col items-center mb-1">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-white">{savingsRate}%</span>
                    <span className="text-xs font-medium text-slate-400">{savingsRate >= 20 ? "Excellent" : "Needs Work"}</span>
                  </div>
                </div>
                
                <button className="mt-6 bg-[#3b82f6]/10 text-[#3b82f6] px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-[#3b82f6]/20 transition-colors w-full">
                  Explore Benefits
                </button>
              </div>
            </div>
          </div>

          {/* ── Bottom: full width tables ── */}
          <div className="space-y-2 mt-10">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Historial y metas</h2>
            <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">Transacciones completas y fondos de ahorro con filtros, exportación y edición.</p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <TransactionsTable selectedMonth={selectedMonth} />
          </div>
          
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 shadow-sm ring-1 ring-slate-100 dark:ring-slate-800">
            <SinkingFundsGrid />
          </div>

          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      )}
    </div>
  )
}