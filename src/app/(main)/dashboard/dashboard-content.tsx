"use client"

import React, { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AreaChart } from "@tremor/react"
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Gauge, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { MonthlyBudget } from "@/components/dashboard/monthly-budget"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getAccountsAtMonth, getMonthTotalsByString, getNetWorthAtMonth } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[24px] border border-border bg-card p-5 sm:p-6"
const RANGES = [3, 6, 12, 24] as const

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[24px] ${className ?? ""}`} />
}

export default function DashboardContent() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [rangeMonths, setRangeMonths] = useState<number>(6)
  const [accIdx, setAccIdx] = useState(0)
  const [showNewAccount, setShowNewAccount] = useState(false)

  const selectedDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1), [today, monthOffset])
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])

  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0

  const netWorthTrend = useMemo(
    () => Array.from({ length: rangeMonths }, (_, i) => {
      const offset = rangeMonths - 1 - i
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), patrimonio: getNetWorthAtMonth(state.accounts, state.transactions, key) }
    }),
    [rangeMonths, selectedDate, state.accounts, state.transactions]
  )
  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)
  const rangeStart = netWorthTrend[0]?.patrimonio ?? 0
  const rangeDelta = netWorth - rangeStart
  const rangePct = rangeStart !== 0 ? Math.round((rangeDelta / Math.abs(rangeStart)) * 100) : 0

  const score = useMemo(() => {
    let s = 0
    s += (Math.max(0, Math.min(savingsRate, 30)) / 30) * 40
    if (monthTotals.neto > 0) s += 20
    if (netWorth > rangeStart) s += 20
    if (displayAccounts.some((a) => a.tipo === "emergencia" && a.saldo > 0)) s += 20
    return Math.round(Math.max(0, Math.min(100, s)))
  }, [savingsRate, monthTotals.neto, netWorth, rangeStart, displayAccounts])

  const scoreTier =
    score >= 80 ? { label: "Excelente", color: "#10b981" }
    : score >= 60 ? { label: "Sólido", color: "#3b82f6" }
    : score >= 40 ? { label: "Mejorable", color: "#f59e0b" }
    : { label: "Frágil", color: "#ef4444" }

  const scoreFactors = [
    { label: "Tasa de ahorro ≥ 20%", ok: savingsRate >= 20 },
    { label: "Flujo del mes positivo", ok: monthTotals.neto > 0 },
    { label: "Patrimonio en crecimiento", ok: netWorth > rangeStart },
    { label: "Fondo de emergencia activo", ok: displayAccounts.some((a) => a.tipo === "emergencia" && a.saldo > 0) },
  ]

  const sortedAccounts = useMemo(() => displayAccounts.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)), [displayAccounts])
  const accCount = sortedAccounts.length
  const safeAccIdx = accCount > 0 ? ((accIdx % accCount) + accCount) % accCount : 0
  const currentAccount = sortedAccounts[safeAccIdx]

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Resumen general</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Hola, Mohamed</h1>
        </div>
        <div className="flex items-center gap-1 self-start rounded-full border border-border bg-card p-1 sm:self-auto">
          <button onClick={() => setMonthOffset((p) => p + 1)} aria-label="Mes anterior" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
          <span className="w-28 text-center text-sm font-medium capitalize text-foreground sm:w-32">{formatMonth(selectedDate)}</span>
          <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} aria-label="Mes siguiente" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </header>

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <h2 className="text-2xl font-bold text-foreground">Bienvenido, Mohamed</h2>
          <p className="mt-2 text-muted-foreground">Comienza configurando tu primera cuenta.</p>
          <Button onClick={() => setShowNewAccount(true)} className="mt-6 rounded-full px-6">Crear cuenta</Button>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-6">
          {/* Fila hero: evolución de patrimonio + puntuación financiera */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Patrimonio + rango */}
            <div className={`${CARD} min-w-0 lg:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="page-section-label">Evolución del patrimonio</p>
                  <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                    <Sensitive><AnimatedNumber value={netWorth} prefix="€" /></Sensitive>
                  </p>
                  <p className={cn("mt-1 inline-flex items-center gap-1 text-sm font-medium", rangeDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {rangeDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <Sensitive>{rangeDelta >= 0 ? "+" : "−"}{formatMoney(Math.abs(rangeDelta), "EUR")}</Sensitive>
                    <span className="text-muted-foreground">· {rangePct >= 0 ? "+" : ""}{rangePct}% en {rangeMonths}M</span>
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
                  {RANGES.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRangeMonths(r)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors",
                        rangeMonths === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {r}M
                    </button>
                  ))}
                </div>
              </div>
              {netWorthHasData ? (
                <AreaChart data={netWorthTrend} index="mes" categories={["patrimonio"]} colors={["blue"]} valueFormatter={chartFormatter} showLegend={false} showGridLines={false} className="mt-4 h-52 sm:h-64" curveType="monotone" showAnimation />
              ) : (
                <div className="mt-4 flex h-52 items-center justify-center rounded-2xl bg-muted/40 text-sm text-muted-foreground sm:h-64">Sin datos de patrimonio todavía</div>
              )}
            </div>

            {/* Puntuación financiera */}
            <div className={`${CARD} flex min-w-0 flex-col`}>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Puntuación financiera</p>
              </div>
              <div className="relative mx-auto my-4 flex items-center justify-center">
                <CircularProgress value={score} size={148} strokeWidth={11} color={scoreTier.color} />
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-bold tabular-nums text-foreground">{score}</span>
                  <span className="text-xs text-muted-foreground">de 100</span>
                </div>
              </div>
              <p className="text-center text-sm font-semibold" style={{ color: scoreTier.color }}>{scoreTier.label}</p>
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {scoreFactors.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", f.ok ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
                      {f.ok ? "✓" : "·"}
                    </span>
                    <span className={f.ok ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <MetricCard label="Balance Total" value={<Sensitive><AnimatedNumber value={netWorth} prefix="€" /></Sensitive>} subtitle="Patrimonio neto actual" icon={Wallet} tone="blue" delay={0} />
            <MetricCard label="Ingresos" value={<Sensitive><AnimatedNumber value={monthTotals.ingresos} prefix="+" /></Sensitive>} subtitle="Este mes" icon={ArrowUpRight} tone="emerald" delay={80} />
            <MetricCard label="Gastos" value={<Sensitive><AnimatedNumber value={monthTotals.gastos} prefix="-" /></Sensitive>} subtitle="Este mes" icon={ArrowDownRight} tone="red" delay={160} />
            <MetricCard label="Tasa de Ahorro" value={`${savingsRate}%`} subtitle="Objetivo del 20%" icon={Target} tone="blue" delay={240} />
          </section>

          {/* Cuentas (carrusel) + Presupuesto */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <div className={`${CARD} min-w-0 lg:col-span-2`}>
              <div className="mb-5 flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Mis cuentas</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowNewAccount(true)} className="text-sm font-medium text-primary transition-colors hover:opacity-70">+ Nueva</button>
                  {accCount > 1 && (
                    <div className="flex items-center gap-1">
                      <button onClick={() => setAccIdx((p) => p - 1)} aria-label="Cuenta anterior" className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
                      <button onClick={() => setAccIdx((p) => p + 1)} aria-label="Cuenta siguiente" className="rounded-full border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronRight className="h-4 w-4" /></button>
                    </div>
                  )}
                </div>
              </div>

              {currentAccount && (() => {
                const cfg = typeConfig[currentAccount.tipo] ?? typeConfig.efectivo
                const I = cfg.icon
                const objetivo = currentAccount.objetivo ?? 0
                const pct = objetivo > 0 ? Math.min((currentAccount.saldo / objetivo) * 100, 100) : 0
                return (
                  <button
                    onClick={() => router.push(`/cuentas/${currentAccount.id}`)}
                    className="group flex w-full flex-col gap-5 rounded-[20px] border border-border bg-muted/30 p-5 text-left transition-colors hover:bg-muted/60 sm:p-6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm" style={{ color: cfg.color }}>
                          <I className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{currentAccount.nombre}</p>
                          <p className="truncate text-xs text-muted-foreground">{currentAccount.banco || cfg.label}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
                    </div>
                    <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">
                      <Sensitive>{formatMoney(currentAccount.saldo, currentAccount.currency)}</Sensitive>
                    </p>
                    {objetivo > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Objetivo</span>
                          <span className="tabular-nums">{Math.round(pct)}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-card">
                          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                  </button>
                )
              })()}

              {accCount > 1 && (
                <div className="mt-4 flex items-center justify-center gap-1.5">
                  {sortedAccounts.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => setAccIdx(i)}
                      aria-label={`Ver ${a.nombre}`}
                      className={cn("h-1.5 rounded-full transition-all", i === safeAccIdx ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40")}
                    />
                  ))}
                </div>
              )}
            </div>

            <MonthlyBudget budgets={state.budgets} transactions={analysisTransactions} categories={state.categories} selectedMonth={selectedMonth} />
          </section>

          <TransactionsTable selectedMonth={selectedMonth} />
          <SinkingFundsGrid />
        </div>
      )}

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
    </div>
  )
}
