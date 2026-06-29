"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AreaChart, DonutChart } from "@tremor/react"
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Target, Wallet } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { MonthlyBudget } from "@/components/dashboard/monthly-budget"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getAccountsAtMonth, getMonthTotalsByString, getNetWorthAtMonth } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"

const CARD = "rounded-[24px] bg-white p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 sm:p-6"

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[24px] ${className ?? ""}`} />
}

export default function DashboardContent() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [showNewAccount, setShowNewAccount] = useState(false)

  const selectedDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1), [today, monthOffset])
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])

  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0

  const topAccounts = useMemo(() => displayAccounts.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 4), [displayAccounts])

  const netWorthTrend = useMemo(
    () => [-5, -4, -3, -2, -1, 0].map((offset) => {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), patrimonio: getNetWorthAtMonth(state.accounts, state.transactions, key) }
    }),
    [selectedDate, state.accounts, state.transactions]
  )
  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  return (
    <div className="w-full max-w-full space-y-6 overflow-x-hidden">
      {/* Cabecera: saludo + selector de mes */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Resumen general</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Hola, Mohamed</h1>
        </div>
        <div className="flex items-center gap-1 self-start rounded-full bg-slate-100 p-1 dark:bg-slate-800 sm:self-auto">
          <button onClick={() => setMonthOffset((p) => p + 1)} aria-label="Mes anterior" className="rounded-full p-2 text-slate-600 transition-colors hover:bg-white hover:shadow-sm active:scale-90 dark:text-slate-400 dark:hover:bg-slate-700"><ChevronLeft className="h-4 w-4" /></button>
          <span className="w-28 text-center text-sm font-medium capitalize text-slate-900 dark:text-white sm:w-32">{formatMonth(selectedDate)}</span>
          <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} aria-label="Mes siguiente" className="rounded-full p-2 text-slate-600 transition-colors hover:bg-white hover:shadow-sm active:scale-90 dark:text-slate-400 dark:hover:bg-slate-700"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Bienvenido, Mohamed</h2>
          <p className="mt-2 text-slate-500">Comienza configurando tu primera cuenta.</p>
          <Button onClick={() => setShowNewAccount(true)} className="mt-6 rounded-full px-6">Crear cuenta</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Métricas */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard label="Balance Total" value={<AnimatedNumber value={netWorth} prefix="€" />} subtitle="Patrimonio neto actual" icon={Wallet} tone="blue" delay={0} />
            <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix="+" />} subtitle="Este mes" icon={ArrowUpRight} tone="emerald" delay={80} />
            <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix="-" />} subtitle="Este mes" icon={ArrowDownRight} tone="red" delay={160} />
            <MetricCard label="Tasa de Ahorro" value={`${savingsRate}%`} subtitle="Objetivo del 20%" icon={Target} tone="violet" delay={240} />
          </section>

          {/* Bento principal */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Columna izquierda */}
            <div className="space-y-4 sm:space-y-6 lg:col-span-2">
              {/* Patrimonio + evolución */}
              <div className={`${CARD} min-w-0`}>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <p className="page-section-label">Patrimonio neto</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 dark:text-white sm:text-3xl">
                      <Sensitive><AnimatedNumber value={netWorth} prefix="€" /></Sensitive>
                    </p>
                  </div>
                  <Link href="/analytics" aria-label="Ver analíticas" className="shrink-0 rounded-full bg-slate-100 p-2 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">
                    <BarChart3 className="h-4 w-4" />
                  </Link>
                </div>
                {netWorthHasData ? (
                  <AreaChart data={netWorthTrend} index="mes" categories={["patrimonio"]} colors={["blue"]} valueFormatter={chartFormatter} showLegend={false} className="h-48 sm:h-[220px]" curveType="monotone" showAnimation />
                ) : (
                  <div className="flex h-48 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800 sm:h-[220px]"><BarChart3 className="h-6 w-6 text-slate-300" /></div>
                )}
              </div>

              {/* Cuentas */}
              <div className={`${CARD} min-w-0`}>
                <div className="mb-6 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Mis cuentas</p>
                  <button onClick={() => setShowNewAccount(true)} className="text-sm font-medium text-foreground transition-colors hover:text-muted-foreground">+ Nueva</button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                  {topAccounts.map((account) => {
                    const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                    const I = cfg.icon
                    return (
                      <button key={account.id} onClick={() => router.push(`/cuentas/${account.id}`)}
                        className="group flex min-w-0 flex-col gap-4 rounded-[20px] bg-slate-50 p-4 text-left transition-all hover:bg-slate-100 active:scale-[0.98] dark:bg-slate-800 dark:hover:bg-slate-700 sm:p-5"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="shrink-0 rounded-full bg-white p-2 shadow-sm dark:bg-slate-900">
                            <I className="h-4 w-4" style={{ color: cfg.color }} />
                          </div>
                          <span className="truncate text-sm font-medium text-slate-900 dark:text-white">{account.nombre}</span>
                        </div>
                        <p className="truncate text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                          <Sensitive>{formatMoney(account.saldo, account.currency)}</Sensitive>
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Columna derecha */}
            <div className="space-y-4 sm:space-y-6">
              {/* Flujo mensual */}
              <div className={`${CARD} min-w-0`}>
                <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Flujo mensual</p>
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

              {/* Presupuesto mensual */}
              <MonthlyBudget budgets={state.budgets} transactions={analysisTransactions} categories={state.categories} selectedMonth={selectedMonth} />

              {/* Tasa de ahorro */}
              <div className={`${CARD} text-center`}>
                <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Tasa de ahorro</p>
                <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums text-foreground">{savingsRate}%</span>
                </div>
              </div>
            </div>
          </section>

          <TransactionsTable selectedMonth={selectedMonth} />
          <SinkingFundsGrid />
        </div>
      )}

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
    </div>
  )
}
