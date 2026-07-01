"use client"

import React, { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { AreaChart } from "@tremor/react"
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Gauge, PiggyBank, Target, TrendingDown, TrendingUp, Wallet } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { MonthlyBudget } from "@/components/dashboard/monthly-budget"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { usePortfolioValue } from "@/lib/investments"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { getAccountsAtMonth, getCategoryBreakdown, getMonthTotalsByString, getNetWorthAtMonth } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[24px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const RANGES = [3, 6, 12, 24] as const

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[24px] ${className ?? ""}`} />
}

function MiniBars({ values, color, signed = false }: { values: number[]; color: string; signed?: boolean }) {
  const max = Math.max(...values.map((v) => Math.abs(v)), 1)
  return (
    <div className="flex h-14 items-end gap-1 border-b border-border/70 pb-px">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[3px] transition-all duration-500"
          style={{
            height: `${Math.max((Math.abs(v) / max) * 100, 8)}%`,
            backgroundColor: signed ? (v < 0 ? "#ef4444" : "#10b981") : color,
            opacity: v === 0 ? 0.16 : 1,
          }}
        />
      ))}
    </div>
  )
}

function AnnualStat({ label, year, value, accent, icon: Icon, children }: { label: string; year: number; value: number; accent: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className={`${CARD} min-w-0`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="page-section-label">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold tracking-tight tabular-nums sm:text-[28px]" style={{ color: accent }}>
            <Sensitive>{formatMoney(value, "EUR")}</Sensitive>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Acumulado {year}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklch, ${accent} 14%, transparent)`, color: accent }}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
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
  const { value: portfolioValue, pnl: portfolioPnl } = usePortfolioValue()
  // El saldo manual de las cuentas de inversión se sustituye por el valor de
  // mercado de la cartera (si no, se contaría dos veces).
  const investmentSaldo = useMemo(() => displayAccounts.filter((a) => a.tipo === "inversion").reduce((s, a) => s + a.saldo, 0), [displayAccounts])
  const netWorthDisplay = netWorth - investmentSaldo + portfolioValue

  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0

  const previousMonth = useMemo(() => {
    const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [selectedDate])
  const previousTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, previousMonth), [analysisTransactions, previousMonth])
  const previousNetWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, previousMonth), [state.accounts, state.transactions, previousMonth])

  const pctDelta = (curr: number, prev: number) => (prev > 0 ? Math.round(((curr - prev) / prev) * 100) : undefined)
  const balanceDelta = previousNetWorth > 0 ? Math.round(((netWorth - previousNetWorth) / previousNetWorth) * 100) : undefined
  const ingresosDelta = pctDelta(monthTotals.ingresos, previousTotals.ingresos)
  const gastosDelta = pctDelta(monthTotals.gastos, previousTotals.gastos)

  const year = selectedDate.getFullYear()
  const monthlyYear = useMemo(
    () => Array.from({ length: 12 }, (_, m) => getMonthTotalsByString(analysisTransactions, `${year}-${String(m + 1).padStart(2, "0")}`)),
    [analysisTransactions, year]
  )
  const annualIngresos = monthlyYear.reduce((s, m) => s + m.ingresos, 0)
  const annualGastos = monthlyYear.reduce((s, m) => s + m.gastos, 0)
  const annualNeto = annualIngresos - annualGastos

  const netWorthTrend = useMemo(
    () => Array.from({ length: rangeMonths }, (_, i) => {
      const offset = rangeMonths - 1 - i
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), patrimonio: getNetWorthAtMonth(state.accounts, state.transactions, key) - investmentSaldo + portfolioValue }
    }),
    [rangeMonths, selectedDate, state.accounts, state.transactions, portfolioValue, investmentSaldo]
  )
  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)
  const rangeStart = netWorthTrend[0]?.patrimonio ?? 0
  const rangeDelta = netWorthDisplay - rangeStart
  const showPct = Math.abs(rangeStart) >= 100
  const rangePct = showPct ? Math.round((rangeDelta / Math.abs(rangeStart)) * 100) : 0

  const spending = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const spendTotal = spending.reduce((s, c) => s + c.monto, 0)
  const topSpending = spending.slice(0, 6)
  const maxSpend = topSpending[0]?.monto ?? 1
  const catColor = (name: string) => state.categories.find((c) => c.name === name)?.color ?? "#3b82f6"

  const score = useMemo(() => {
    let s = 0
    s += (Math.max(0, Math.min(savingsRate, 30)) / 30) * 40
    if (monthTotals.neto > 0) s += 20
    if (netWorthDisplay > rangeStart) s += 20
    if (displayAccounts.some((a) => a.tipo === "emergencia" && a.saldo > 0)) s += 20
    return Math.round(Math.max(0, Math.min(100, s)))
  }, [savingsRate, monthTotals.neto, netWorthDisplay, rangeStart, displayAccounts])

  const scoreTier =
    score >= 80 ? { label: "Excelente", color: "#10b981" }
    : score >= 60 ? { label: "Sólido", color: "#3b82f6" }
    : score >= 40 ? { label: "Mejorable", color: "#f59e0b" }
    : { label: "Frágil", color: "#ef4444" }

  const scoreFactors = [
    { label: "Tasa de ahorro ≥ 20%", ok: savingsRate >= 20 },
    { label: "Flujo del mes positivo", ok: monthTotals.neto > 0 },
    { label: "Patrimonio en crecimiento", ok: netWorthDisplay > rangeStart },
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
    <div className="content-fade w-full max-w-full space-y-6 overflow-x-hidden sm:space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Resumen general</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Hola, Mohamed</h1>
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
                    <AnimatedNumber value={netWorthDisplay} />
                  </p>
                  <p className={cn("mt-1 inline-flex flex-wrap items-center gap-x-1.5 text-sm font-medium", rangeDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {rangeDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <Sensitive>{rangeDelta >= 0 ? "+" : "−"}{formatMoney(Math.abs(rangeDelta), "EUR")}</Sensitive>
                    <span className="text-muted-foreground">{showPct ? `· ${rangePct >= 0 ? "+" : ""}${rangePct}% ` : ""}en {rangeMonths}M</span>
                  </p>
                  {portfolioValue > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Incluye <Sensitive>{formatMoney(portfolioValue, "EUR")}</Sensitive> en inversiones
                      <span className={cn("ml-1 font-semibold", portfolioPnl >= 0 ? "text-emerald-500" : "text-red-500")}>({portfolioPnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(portfolioPnl), "EUR")})</span>
                    </p>
                  )}
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
                <AreaChart data={netWorthTrend} index="mes" categories={["patrimonio"]} colors={["blue"]} valueFormatter={chartFormatter} showLegend={false} showGridLines={false} showYAxis={false} className="mt-4 h-52 sm:h-64" curveType="monotone" showAnimation />
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
            <MetricCard label="Balance total" value={<AnimatedNumber value={netWorthDisplay} />} subtitle={portfolioValue > 0 ? "Cuentas + inversiones" : "Patrimonio neto actual"} icon={Wallet} tone="blue" delta={balanceDelta} delay={0} />
            <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix="+" />} subtitle="vs. mes anterior" icon={ArrowUpRight} tone="emerald" delta={ingresosDelta} delay={80} />
            <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix="-" />} subtitle="vs. mes anterior" icon={ArrowDownRight} tone="red" delta={gastosDelta} deltaGoodWhenUp={false} delay={160} />
            <MetricCard label="Tasa de ahorro" value={`${savingsRate}%`} subtitle="Objetivo del 20%" icon={Target} tone="blue" delay={240} />
          </section>

          {/* Acumulado anual */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <AnnualStat label="Ingresos totales" year={year} value={annualIngresos} accent="#10b981" icon={ArrowUpRight}>
              <MiniBars values={monthlyYear.map((m) => m.ingresos)} color="#10b981" />
            </AnnualStat>
            <AnnualStat label="Gastos totales" year={year} value={annualGastos} accent="#ef4444" icon={ArrowDownRight}>
              <MiniBars values={monthlyYear.map((m) => m.gastos)} color="#ef4444" />
            </AnnualStat>
            <AnnualStat label="Ahorro neto anual" year={year} value={annualNeto} accent={annualNeto >= 0 ? "#10b981" : "#ef4444"} icon={PiggyBank}>
              <MiniBars values={monthlyYear.map((m) => m.neto)} color="#3b82f6" signed />
            </AnnualStat>
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
                const objetivo = currentAccount.objetivo ?? 0
                const pct = objetivo > 0 ? Math.min((currentAccount.saldo / objetivo) * 100, 100) : 0
                return (
                  <button
                    onClick={() => router.push(`/cuentas/${currentAccount.id}`)}
                    className="group flex w-full flex-col gap-5 rounded-[20px] border border-border bg-muted/30 p-5 text-left transition-colors hover:bg-muted/60 sm:p-6"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <AccountLogo account={currentAccount} className="h-11 w-11" />
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

          {topSpending.length > 0 && (
            <div className={`${CARD} min-w-0`}>
              <div className="mb-5 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Distribución de gastos</p>
                <p className="text-sm tabular-nums text-muted-foreground"><Sensitive>{formatMoney(spendTotal, "EUR")}</Sensitive></p>
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                {topSpending.map((c) => (
                  <div key={c.categoria} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: catColor(c.categoria) }} />
                        <span className="truncate">{c.categoria}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        <Sensitive>{formatMoney(c.monto, "EUR")}</Sensitive> · {Math.round((c.monto / spendTotal) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(c.monto / maxSpend) * 100}%`, backgroundColor: catColor(c.categoria) }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <TransactionsTable selectedMonth={selectedMonth} />
          <SinkingFundsGrid />
        </div>
      )}

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
    </div>
  )
}
