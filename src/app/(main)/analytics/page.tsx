"use client"

import React from "react"
import { useMemo, useState, memo, useRef, useEffect } from "react"
import { BarChart, DonutChart } from "@tremor/react"
import { Activity, AlertTriangle, Calendar, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, FileDown, Gauge, Layers3, Lightbulb, PiggyBank, Target, Wallet, Wallet2 } from "lucide-react"
import { useToast } from "@/components/ui/toast"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MetricCard } from "@/components/dashboard/metric-card"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { accountGoal, buildMonthlyCashFlow, buildNetWorthHistory, getCategoryBreakdown, getCategoryInsights, getFinancialTips, getMonthTotalsByString, getNeedsVsWantsForMonth, getUpcomingRecurring, countsTowardCashFlow, buildPreciseNetWorthHistory, getCurrencyByAccount, reportingAmount } from "@/lib/calculations"
import { useFinance } from "@/lib/store"
import { usePortfolioValue, accountDisplayValue, useDisplayAccounts } from "@/lib/investments"
import { formatMoney } from "@/lib/currency"
import { money, signedMoney, chartFormatter, formatMonth, isInitialBalanceTransaction } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"
import { PatrimonioMensualSection } from "@/components/analytics/patrimonio-mensual"

// Mismo umbral que MonthlyBudget (src/components/dashboard/monthly-budget.tsx).
const BUDGET_WARNING_THRESHOLD = 80

const CategoryTooltip = createChartTooltip(["monto"], ["violet"])
const AccountTooltip = createChartTooltip(["monto"], ["blue"])
const NeedsWantsTooltip = createChartTooltip(["Necesidades", "Deseos"], ["emerald", "amber"])

const CollapsibleBlock = memo(function CollapsibleBlock({
  title,
  hint,
  defaultOpen = false,
  children,
}: {
  title: string
  hint?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="space-y-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-6">{children}</div>}
    </section>
  )
})

const RuleCard = memo(function RuleCard({ label, target, actual, value, tone, delay }: { label: string; target: number; actual: number; value: number; tone: string; delay: number }) {
  const diff = actual - target
  const width = Math.min(Math.max(actual, 0), 100)
  const good = Math.abs(diff) <= 6 || (label.includes("Ahorro") && actual >= target)

  return (
    <div className="stagger-fade glass-card rounded-[16px] p-5 card-glow glass-card-hover" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="page-section-label">{label}</p>
          <p className="mt-2 text-2xl font-bold tabular-nums" style={{ color: tone }}>
            <AnimatedNumber value={Math.round(value)} />
          </p>
        </div>
        <span className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-semibold tabular-nums ring-1 ring-border/20">{Math.round(actual)}%</span>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${width}%`, backgroundColor: tone }} />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Objetivo {target}%</span>
          <span className={good ? "text-emerald-500" : "text-amber-500"}>{diff === 0 ? "En objetivo" : `${diff > 0 ? "+" : ""}${Math.round(diff)} pts`}</span>
        </div>
      </div>
    </div>
  )
})

const HEATMAP_BG = ["bg-muted/40", "bg-red-500/20", "bg-red-500/40", "bg-red-500/65", "bg-red-500/90"]
const HEATMAP_TEXT = ["text-muted-foreground", "text-red-700 dark:text-red-300", "text-white", "text-white", "text-white"]
const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"]

// Cuadrícula tipo "contribution graph": un cuadro por día del mes, intensidad
// según el gasto de ese día (normalizado contra el día de mayor gasto), para
// detectar de un vistazo si el gasto se concentra en fines de semana o en
// fechas concretas.
const DayHeatmap = memo(function DayHeatmap({ dailyTotals, firstWeekday }: { dailyTotals: number[]; firstWeekday: number }) {
  const maxDay = Math.max(...dailyTotals, 0)
  const intensity = (total: number) => {
    if (total <= 0 || maxDay === 0) return 0
    const ratio = total / maxDay
    if (ratio > 0.75) return 4
    if (ratio > 0.5) return 3
    if (ratio > 0.25) return 2
    return 1
  }

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {WEEKDAY_LABELS.map((d) => (
        <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground">{d}</div>
      ))}
      {Array.from({ length: firstWeekday }).map((_, i) => <div key={`empty-${i}`} />)}
      {dailyTotals.map((total, i) => {
        const level = intensity(total)
        return (
          <div key={i} className="group relative">
            <div
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-[11px] font-semibold ring-1 ring-inset transition-all group-hover:scale-110",
                HEATMAP_BG[level],
                HEATMAP_TEXT[level],
                level === 0 ? "ring-border/40" : "ring-black/10"
              )}
            >
              {i + 1}
            </div>
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 scale-95 whitespace-nowrap rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs opacity-0 shadow-lg transition-all duration-150 group-hover:scale-100 group-hover:opacity-100">
              <p className="font-semibold text-foreground">Día {i + 1}</p>
              <p className={total > 0 ? "text-red-500" : "text-muted-foreground"}>{total > 0 ? <Sensitive>{money(total)}</Sensitive> : "Sin gasto"}</p>
              <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-border bg-popover" />
            </div>
          </div>
        )
      })}
    </div>
  )
})

export default function AnalyticsPage() {
  const { state, loading, dispatch } = useFinance()
  const currencyByAccount = useMemo(() => getCurrencyByAccount(state.accounts), [state.accounts])
  // Para los consejos: cuentas con el valor real (mercado) en inversión, la
  // misma cifra que el resto de widgets de la app.
  const displayAccounts = useDisplayAccounts()
  const [monthOffset, setMonthOffset] = useState(0)
  const TREND_MONTHS = 6
  const shownBudgetIds = useRef(new Set<string>())
  const { toast } = useToast()

  const today = new Date()
  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasData = analysisTransactions.length > 0

  const [confirmReset, setConfirmReset] = useState(false)

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  // Misma fuente de reglas que Cuentas/Inversiones (getFinancialTips): la
  // recomendación del diagnóstico rápido deja de ser un único if/else propio
  // de esta página y pasa a ser el consejo de mayor severidad del motor.
  const tips = useMemo(
    () => getFinancialTips(analysisTransactions, displayAccounts, state.sinkingFunds, selectedMonth, 4, currencyByAccount),
    [analysisTransactions, displayAccounts, state.sinkingFunds, selectedMonth, currencyByAccount]
  )
  const topTip = tips[0]
  const dailyTotals = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const totals = new Array(daysInMonth).fill(0)
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || !countsTowardCashFlow(t, analysisTransactions) || !t.fecha.startsWith(selectedMonth)) continue
      const day = new Date(t.fecha).getDate()
      totals[day - 1] += reportingAmount(t, currencyByAccount)
    }
    return totals
  }, [analysisTransactions, selectedMonth, currencyByAccount])
  // getDay() da 0=domingo..6=sábado; se convierte a semana de lunes a domingo.
  const firstWeekday = (new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() + 6) % 7
  const { necesidades, deseos } = useMemo(() => getNeedsVsWantsForMonth(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  // De qué cuenta sale el gasto del mes (no solo en qué categoría se va),
  // para detectar qué cuenta se vacía más rápido.
  const spendByAccount = useMemo(() => {
    const accountById = new Map(state.accounts.map((a) => [a.id, a]))
    const totals = new Map<string, number>()
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || !countsTowardCashFlow(t, analysisTransactions) || !t.fecha.startsWith(selectedMonth)) continue
      totals.set(t.cuenta_id, (totals.get(t.cuenta_id) ?? 0) + reportingAmount(t, currencyByAccount))
    }
    return Array.from(totals.entries())
      .map(([cuentaId, monto]) => ({ cuenta: accountById.get(cuentaId)?.nombre ?? "Cuenta eliminada", monto }))
      .sort((a, b) => b.monto - a.monto)
  }, [state.accounts, analysisTransactions, selectedMonth, currencyByAccount])
  const categoryInsights = useMemo(() => getCategoryInsights(analysisTransactions, selectedMonth, 3, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  // Mismo patrón que MonthlyBudget: un único pase agrupa el gasto por
  // categoría, en vez de recorrer transacciones una vez por presupuesto.
  const budgetProgress = useMemo(() => {
    const categoryById = new Map(state.categories.map((c) => [c.id, c]))
    const spentByCategory = new Map<string, number>()
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || !t.fecha.startsWith(selectedMonth)) continue
      spentByCategory.set(t.categoria, (spentByCategory.get(t.categoria) ?? 0) + reportingAmount(t, currencyByAccount))
    }
    return state.budgets
      .filter((b) => b.month === selectedMonth)
      .map((budget) => {
        const category = categoryById.get(budget.category_id)
        const spent = spentByCategory.get(category?.name ?? "") ?? 0
        return {
          id: budget.id,
          categoryName: category?.name ?? "Sin categoría",
          categoryColor: category?.color ?? "var(--muted-foreground)",
          amount: budget.amount,
          spent,
          percentage: budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)
  }, [state.budgets, state.categories, analysisTransactions, selectedMonth, currencyByAccount])
  const cashFlow = useMemo(() => buildMonthlyCashFlow(analysisTransactions, selectedMonth, TREND_MONTHS, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  // Cashflow indexado por YYYY-MM para el detalle mensual unificado (patrimonio + ingresos/gastos/neto).
  const cashByMonthKey = useMemo(() => {
    const map: Record<string, { ingresos: number; gastos: number; neto: number }> = {}
    const keys = new Set<string>()
    for (const t of analysisTransactions) {
      if (t.fecha && t.fecha.length >= 7) keys.add(t.fecha.slice(0, 7))
    }
    const [ey, em] = selectedMonth.split("-").map(Number)
    for (let i = 0; i < 48; i++) {
      const d = new Date(ey, em - 1 - i, 1)
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
    for (const key of keys) {
      map[key] = getMonthTotalsByString(analysisTransactions, key, currencyByAccount)
    }
    return map
  }, [analysisTransactions, selectedMonth, currencyByAccount])
  const { valueByAccount, investedByAccount } = usePortfolioValue()
  // Para el historial completo: necesitamos posiciones y precio histórico
  const { positions: investPositions } = usePortfolioValue()
  // Precio histórico mensual (2 años) para el cálculo preciso
  const historySymbolsKey = useMemo(
    () => [...new Set(investPositions.filter((p) => p.kind !== "custom").map((p) => p.symbol))].sort().join(","),
    [investPositions]
  )
  const [priceHistory, setPriceHistory] = useState<Record<string, { t: number; c: number }[]>>({})
  useEffect(() => {
    const syms = historySymbolsKey ? historySymbolsKey.split(",") : []
    if (syms.length === 0) { setPriceHistory({}); return }
    let cancelled = false
    // Fetch 5 años (máximo de la API)
    fetch(`/api/history?symbols=${encodeURIComponent(syms.join(","))}&interval=1mo&range=5y`)
      .then((r) => r.json())
      .then((d: { history?: Record<string, { t: number; c: number }[]> }) => { if (!cancelled) setPriceHistory(d.history ?? {}) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [historySymbolsKey])
  // Objetivo consolidado por cuenta: propio (accountGoal ya combina objetivo
  // directo + metas de ahorro vinculadas) frente al valor actual de la cuenta,
  // reutilizando accountDisplayValue para que las cuentas de inversión usen
  // su valor de mercado real igual que en el resto de la página.
  const goalProgress = useMemo(() => {
    return state.accounts
      .map((a) => ({ account: a, goal: accountGoal(a, state.sinkingFunds), current: accountDisplayValue(a, valueByAccount, investedByAccount) }))
      .filter((g) => g.goal > 0)
      .map((g) => ({ ...g, pct: Math.min((g.current / g.goal) * 100, 100), restante: Math.max(g.goal - g.current, 0) }))
      .sort((a, b) => b.pct - a.pct)
  }, [state.accounts, state.sinkingFunds, valueByAccount, investedByAccount])

   // Toast alerts for budget overruns
   useEffect(() => {
     if (!hasData) return;
     budgetProgress.forEach((budget) => {
       const { id, percentage, categoryName, amount, spent } = budget;
       if (percentage >= 100 && !shownBudgetIds.current.has(id)) {
         toast(`Has superado el presupuesto de "${categoryName}" (${formatMoney(spent, "EUR")} de ${formatMoney(amount, "EUR")})`, "error");
         shownBudgetIds.current.add(id);
       } else if (percentage >= BUDGET_WARNING_THRESHOLD && percentage < 100 && !shownBudgetIds.current.has(id)) {
         toast(`Estás cerca de superar el presupuesto de "${categoryName}" (${formatMoney(spent, "EUR")} de ${formatMoney(amount, "EUR")})`, "info");
         shownBudgetIds.current.add(id);
       }
     });
   }, [budgetProgress, toast, hasData])

  // Previsión de recurrentes: siempre mira hacia el próximo vencimiento real
  // (no depende del mes que se esté navegando en el resto de la página), como
  // ya hace la misma tarjeta en Movimientos.
  const upcomingRecurring = useMemo(() => getUpcomingRecurring(state.transactions), [state.transactions])
  const upcomingRecurringMonthTotal = useMemo(() => {
    const now = new Date()
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    return upcomingRecurring
      .filter((item) => item.tipo === "gasto" && item.nextDate.startsWith(monthKey))
      .reduce((s, item) => s + item.monto, 0)
  }, [upcomingRecurring])
  // Las cuentas de inversión no bajan su saldo al comprar una posición (no
  // genera un gasto), así que el patrimonio en crudo mezcla efectivo sin
  // invertir con dinero ya invertido. Se sustituye la parte invertida por su
  // valor de mercado real (ver accountDisplayValue), igual que en
  // Dashboard/Cuentas/Inversiones — si no, esta página mostraba una cifra de
  // patrimonio distinta a la del resto de la app.
  const investmentAccounts = useMemo(() => state.accounts.filter((a) => a.tipo === "inversion"), [state.accounts])
  const investmentSaldo = useMemo(() => investmentAccounts.reduce((s, a) => s + a.saldo, 0), [investmentAccounts])
  const investmentDisplayTotal = useMemo(
    () => investmentAccounts.reduce((s, a) => s + accountDisplayValue(a, valueByAccount, investedByAccount), 0),
    [investmentAccounts, valueByAccount, investedByAccount]
  )
  const rawNetWorthHistory = useMemo(() => buildNetWorthHistory(state.transactions, state.accounts, selectedMonth, TREND_MONTHS), [state.transactions, state.accounts, selectedMonth])
  const netWorthHistory = useMemo(
    () => rawNetWorthHistory.map((point) => ({ ...point, patrimonio: point.patrimonio - investmentSaldo + investmentDisplayTotal })),
    [rawNetWorthHistory, investmentSaldo, investmentDisplayTotal]
  )

  const currentNetWorth = netWorthHistory.at(-1)?.patrimonio ?? 0
  const previousNetWorth = netWorthHistory.at(-2)?.patrimonio ?? currentNetWorth
  const netWorthChange = currentNetWorth - previousNetWorth
  const totalSpending = necesidades + deseos
  const needsPct = totalSpending > 0 ? (necesidades / totalSpending) * 100 : 0
  const wantsPct = totalSpending > 0 ? (deseos / totalSpending) * 100 : 0
  const savingsActual = monthTotals.ingresos > 0 ? Math.max((monthTotals.neto / monthTotals.ingresos) * 100, 0) : 0
  const topCategory = categoryBreakdown[0]
  // La ventana de cashFlow siempre tiene 6 meses aunque el usuario lleve
  // menos tiempo usando la app; los meses sin ningún movimiento (ni ingresos
  // ni gastos) no cuentan como "mes con cash flow positivo" ni entran en la
  // media, o si no se infla la racha/promedio con meses que nunca existieron.
  const activeCashFlow = useMemo(() => cashFlow.filter((item) => item.ingresos > 0 || item.gastos > 0), [cashFlow])
  const averageMonthlyNet = activeCashFlow.length > 0 ? Math.round(activeCashFlow.reduce((sum, item) => sum + item.neto, 0) / activeCashFlow.length) : 0
  const positiveMonths = activeCashFlow.filter((item) => item.neto >= 0).length
  const netWorthTrendPositive = netWorthChange >= 0


  const needsWantsData = [
    { name: "Necesidades", value: necesidades },
    { name: "Deseos", value: deseos },
  ]

  // ===== HISTORIAL COMPLETO PRECISO (diario desde primera transacción) =====
  const fullHistory = useMemo(() => {
    if (!hasData) return []
    const firstTxDate = state.transactions.length > 0
      ? new Date(Math.min(...state.transactions.map(t => new Date(t.fecha).getTime())))
      : today
    const totalDays = Math.ceil((today.getTime() - firstTxDate.getTime()) / 86400000) + 1
    const precise = buildPreciseNetWorthHistory(
      state.accounts,
      state.transactions,
      investPositions,
      priceHistory,
      Math.min(totalDays, 1000),
      today
    )
    return precise.map(p => ({
      mes: p.label,
      patrimonio: p.patrimonio,
      breakdown: p.breakdown,
      date: p.date
    }))
  }, [hasData, state.accounts, state.transactions, investPositions, priceHistory, today])

  // Pico histórico absoluto
  const fullHistoryPeak = useMemo(() => 
    fullHistory.reduce((best, d) => (d.patrimonio > best.patrimonio ? d : best), fullHistory[0] ?? { patrimonio: 0, mes: '—', date: '' }), [fullHistory])


  // Diagnóstico del cálculo

  // Persistir pico histórico en localStorage para que nunca se pierda
  const [savedPeak, setSavedPeak] = useState<{ value: number; date: string; label: string } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('netWorthPeak')
      return saved ? JSON.parse(saved) : null
    }
    return null
  })


  // Guardar pico en localStorage + settings (nube) cuando cambia
  useEffect(() => {
    if (fullHistoryPeak && fullHistoryPeak.patrimonio > 0) {
      const peakData = { value: fullHistoryPeak.patrimonio, date: fullHistoryPeak.date, label: fullHistoryPeak.mes }
      if (!savedPeak || peakData.value > savedPeak.value) {
        try { localStorage.setItem('netWorthPeak', JSON.stringify(peakData)) } catch {}
        setSavedPeak(peakData)
        import("@/lib/net-worth-snapshots").then(({ persistNetWorthPeakIfHigher }) => {
          persistNetWorthPeakIfHigher(peakData).catch(() => {})
        })
      }
    }
  }, [fullHistoryPeak, savedPeak])

  // Hidratar pico desde settings si localStorage está vacío o es menor
  useEffect(() => {
    let cancelled = false
    import("@/lib/net-worth-snapshots").then(({ loadNetWorthPeak }) =>
      loadNetWorthPeak().then((cloud) => {
        if (cancelled || !cloud) return
        setSavedPeak((prev) => {
          if (prev && prev.value >= cloud.value) return prev
          try { localStorage.setItem('netWorthPeak', JSON.stringify(cloud)) } catch {}
          return cloud
        })
      })
    )
    return () => { cancelled = true }
  }, [])


  const [exportingPdf, setExportingPdf] = useState(false)
  const handleExportPdf = async () => {
    setExportingPdf(true)
    try {
      const { generateAnalyticsPdf } = await import("@/lib/analytics-pdf")
      generateAnalyticsPdf({
        owner: "Mohamed",
        month: formatMonth(selectedDate),
        netWorth: currentNetWorth,
        netWorthChange,
        ingresos: monthTotals.ingresos,
        gastos: monthTotals.gastos,
        neto: monthTotals.neto,
        savingsRate: Math.round(savingsActual),
        netWorthTrend: netWorthHistory.map((d) => ({ label: d.mes, value: Math.round(d.patrimonio) })),
        categoryBreakdown,
        necesidadesPct: needsPct,
        deseosPct: wantsPct,
        ahorroPct: savingsActual,
        budgets: budgetProgress.map((b) => ({ categoria: b.categoryName, gastado: b.spent, limite: b.amount })),
        insights: categoryInsights,
      })
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Centro de inteligencia financiera</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Analíticas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="w-28 text-center text-sm font-medium text-foreground sm:w-32">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {hasData && (
            <Button variant="outline" size="sm" className="gap-1.5 rounded-full" onClick={handleExportPdf} disabled={exportingPdf}>
              <FileDown className="h-4 w-4" /> {exportingPdf ? "Generando…" : "Descargar PDF"}
            </Button>
          )}
          {hasData && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmReset(true)}>Limpiar</Button>}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
          </div>
          <Skeleton className="h-80" />
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              label="Patrimonio"
              value={<AnimatedNumber value={Math.round(currentNetWorth)} />}
              subtitle={<>{netWorthTrendPositive ? "Sube" : "Baja"} <Sensitive>{signedMoney(netWorthChange)}</Sensitive> vs mes previo</>}
              icon={Wallet}
              tone={netWorthTrendPositive ? "emerald" : "red"}
              delay={0}
            />
            <MetricCard
              label="Neto del mes"
              value={<AnimatedNumber value={monthTotals.neto} />}
              subtitle={<><Sensitive>{money(monthTotals.ingresos)}</Sensitive> ingresos · <Sensitive>{money(monthTotals.gastos)}</Sensitive> gastos</>}
              icon={Activity}
              tone={monthTotals.neto >= 0 ? "blue" : "amber"}
              delay={70}
            />
            <MetricCard
              label="Cash flow medio"
              value={<Sensitive>{signedMoney(averageMonthlyNet)}</Sensitive>}
              subtitle={activeCashFlow.length > 0 ? `Media ${TREND_MONTHS} meses · ${positiveMonths}/${activeCashFlow.length} positivos` : "Sin histórico todavía"}
              icon={PiggyBank}
              tone={averageMonthlyNet >= 0 ? "emerald" : "red"}
              delay={140}
            />
          </section>

          <PatrimonioMensualSection dailyHistory={fullHistory} cashByMonth={cashByMonthKey} />

          <CollapsibleBlock title="Mes" hint="Categorías, presupuesto, pagos y calendario de gasto" defaultOpen>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="stagger-fade">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><Layers3 className="h-4 w-4 text-violet-500" />Gastos por categoría</CardTitle>
                  {topCategory && <span className="text-xs text-muted-foreground">Top: <strong className="text-foreground">{topCategory.categoria}</strong></span>}
                </CardHeader>
                <CardContent>
                  {categoryBreakdown.length === 0 ? <EmptyState icon={Layers3} title="Sin gasto categorizado" description="Cuando registres gastos, aquí verás las categorías que más pesan." bordered className="h-full" /> : (
                    <div role="img" aria-label={`Gráfico de barras: gasto por categoría${topCategory ? `, encabezado por ${topCategory.categoria}` : ""}`} style={{ height: categoryBreakdown.slice(0, 8).length * 52 + 48 }}>
                      <BarChart data={categoryBreakdown.slice(0, 8)} index="categoria" categories={["monto"]} colors={["violet"]} valueFormatter={chartFormatter} yAxisWidth={80} customTooltip={CategoryTooltip} className="h-full" showAnimation layout="vertical" />
                    </div>
                  )}
                </CardContent>
              </Card>

              {spendByAccount.length > 0 && (
                <Card className="stagger-fade">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><Wallet className="h-4 w-4 text-blue-500" />Gasto por cuenta</CardTitle>
                    <span className="text-xs text-muted-foreground">Top: <strong className="text-foreground">{spendByAccount[0].cuenta}</strong></span>
                  </CardHeader>
                  <CardContent>
                    <div role="img" aria-label={`Gráfico de barras: gasto por cuenta, encabezado por ${spendByAccount[0].cuenta}`} style={{ height: spendByAccount.slice(0, 8).length * 52 + 48 }}>
                      <BarChart data={spendByAccount.slice(0, 8)} index="cuenta" categories={["monto"]} colors={["blue"]} valueFormatter={chartFormatter} yAxisWidth={80} customTooltip={AccountTooltip} className="h-full" showAnimation layout="vertical" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {budgetProgress.length > 0 && (
                <Card className="stagger-fade">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><Wallet2 className="h-4 w-4 text-primary" />Presupuesto vs real</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {budgetProgress.map((b) => {
                      const over = b.percentage >= 100
                      const warning = !over && b.percentage >= BUDGET_WARNING_THRESHOLD
                      return (
                        <div key={b.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-2 font-medium text-muted-foreground">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                              <span className="truncate">{b.categoryName}</span>
                              {(over || warning) && <AlertTriangle className={cn("h-3 w-3 shrink-0", over ? "text-red-500" : "text-amber-500")} />}
                            </span>
                            <span className={cn("shrink-0 font-semibold tabular-nums", over ? "text-red-500" : warning ? "text-amber-500" : "text-foreground")}>
                              <Sensitive>{formatMoney(b.spent, "EUR")}</Sensitive> / <Sensitive>{formatMoney(b.amount, "EUR")}</Sensitive>
                            </span>
                          </div>
                          <Progress value={b.percentage} className={cn(
                            "[&_[data-slot=progress-track]]:h-2",
                            over ? "[&_[data-slot=progress-indicator]]:bg-red-500" : warning ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-foreground"
                          )} />
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}

              {upcomingRecurring.length > 0 && (
                <Card className="stagger-fade">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><CalendarClock className="h-4 w-4 text-primary" />Próximos pagos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upcomingRecurringMonthTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Recurrente previsto este mes: <Sensitive as="span" className="font-semibold text-foreground">{formatMoney(upcomingRecurringMonthTotal, "EUR")}</Sensitive>
                      </p>
                    )}
                    <div className="space-y-2">
                      {upcomingRecurring.slice(0, 4).map((item) => (
                        <div key={item.key} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{item.descripcion || item.categoria}</p>
                            <p className={cn("text-[11px] font-medium", item.overdueDays > 0 ? "text-red-500" : "text-muted-foreground")}>
                              {item.overdueDays > 0 ? `Atrasado ${item.overdueDays}d` : item.overdueDays === 0 ? "Hoy" : new Date(item.nextDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                              {item.frequency !== "mensual" && ` · ${item.frequency === "semanal" ? "Semanal" : "Anual"}`}
                            </p>
                          </div>
                          <span className={cn("shrink-0 text-xs font-bold tabular-nums", (item.tipo === "ingreso" ? item.monto : -item.monto) >= 0 ? "text-emerald-500" : "text-foreground")}>
                            <Sensitive>{(item.tipo === "ingreso" ? item.monto : -item.monto) >= 0 ? "+" : "-"}{formatMoney(Math.abs(item.monto), "EUR")}</Sensitive>
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {monthTotals.gastos > 0 && (
              <Card className="stagger-fade">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><Calendar className="h-4 w-4 text-red-500" />Gasto por día</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mx-auto max-w-md">
                    <DayHeatmap dailyTotals={dailyTotals} firstWeekday={firstWeekday} />
                  </div>
                </CardContent>
              </Card>
            )}
          </CollapsibleBlock>

          <CollapsibleBlock title="Hábitos" hint="Necesidades vs deseos, regla 50/30/20 y objetivos">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="stagger-fade">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><Gauge className="h-4 w-4 text-amber-500" />Necesidades vs deseos</CardTitle>
                </CardHeader>
                <CardContent>
                  {totalSpending === 0 ? <EmptyState icon={Gauge} title="Sin gastos este mes" description="La distribución aparecerá al registrar necesidades y deseos." bordered className="h-full" /> : (
                    <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center">
                      <div role="img" aria-label={`Gráfico circular: ${Math.round(needsPct)}% necesidades, ${Math.round(wantsPct)}% deseos`}>
                        <DonutChart data={needsWantsData} category="value" index="name" colors={["emerald", "amber"]} variant="donut" valueFormatter={chartFormatter} customTooltip={NeedsWantsTooltip} className="mx-auto h-44 w-44" showAnimation />
                      </div>
                      <div className="space-y-3">
                        <div className="rounded-2xl bg-emerald-500/[0.05] p-3 ring-1 ring-emerald-500/10">
                          <div className="flex items-center justify-between text-sm"><span>Necesidades</span><strong className="text-emerald-500 tabular-nums">{Math.round(needsPct)}%</strong></div>
                          <p className="mt-1 text-xs text-muted-foreground"><Sensitive>{money(necesidades)}</Sensitive></p>
                        </div>
                        <div className="rounded-2xl bg-amber-500/[0.05] p-3 ring-1 ring-amber-500/10">
                          <div className="flex items-center justify-between text-sm"><span>Deseos</span><strong className="text-amber-500 tabular-nums">{Math.round(wantsPct)}%</strong></div>
                          <p className="mt-1 text-xs text-muted-foreground"><Sensitive>{money(deseos)}</Sensitive></p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {goalProgress.length > 0 && (
                <Card className="stagger-fade">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><Target className="h-4 w-4 text-emerald-500" />Objetivos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {goalProgress.map((g) => {
                      const complete = g.pct >= 100
                      return (
                        <div key={g.account.id} className="space-y-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="flex min-w-0 items-center gap-2 font-medium text-muted-foreground">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.account.color }} />
                              <span className="truncate">{g.account.nombre}</span>
                            </span>
                            <span className={cn("shrink-0 font-semibold tabular-nums", complete ? "text-emerald-500" : "text-foreground")}>
                              <Sensitive>{formatMoney(g.current, g.account.currency)}</Sensitive> / <Sensitive>{formatMoney(g.goal, g.account.currency)}</Sensitive>
                            </span>
                          </div>
                          <Progress value={g.pct} className="[&_[data-slot=progress-track]]:h-2 [&_[data-slot=progress-indicator]]:bg-emerald-500" />
                          {!complete && (
                            <p className="text-[11px] text-muted-foreground">Faltan <Sensitive as="span">{formatMoney(g.restante, g.account.currency)}</Sensitive> · {Math.round(g.pct)}% completado</p>
                          )}
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <RuleCard label="50% Necesidades" target={50} actual={needsPct} value={necesidades} tone="var(--accent-green)" delay={100} />
              <RuleCard label="30% Deseos" target={30} actual={wantsPct} value={deseos} tone="var(--accent-amber)" delay={170} />
              <RuleCard label="20% Ahorro" target={20} actual={savingsActual} value={monthTotals.neto} tone="var(--accent-blue)" delay={240} />
            </div>
          </CollapsibleBlock>

          <CollapsibleBlock title="Alertas" hint="Diagnóstico e insights del mes">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card className="stagger-fade">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><PiggyBank className="h-4 w-4 text-blue-500" />Diagnóstico rápido</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/20">
                    <p className="text-xs text-muted-foreground">Recomendación</p>
                    <p className="mt-1 text-sm font-medium leading-6">{topTip?.message ?? (monthTotals.neto >= 0 ? "Buen mes. Mantén el ahorro automático y revisa si puedes subir aportaciones." : "Mes negativo. Revisa categorías grandes y congela gastos variables unos días.")}</p>
                  </div>
                </CardContent>
              </Card>

              {categoryInsights.length > 0 && (
                <Card className="stagger-fade">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold"><Activity className="h-4 w-4 text-[var(--gold)]" />Lo que ha cambiado</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {categoryInsights.map((insight) => {
                      const up = insight.isNew || insight.deltaPct > 0
                      return (
                        <div key={insight.categoria} className="flex items-start gap-3 rounded-2xl bg-muted/35 p-3.5 ring-1 ring-border/20">
                          <Lightbulb className={cn("mt-0.5 h-4 w-4 shrink-0", up ? "text-amber-500" : "text-emerald-500")} />
                          <p className="text-sm leading-6">
                            <strong className="font-semibold">{insight.categoria}</strong>{" "}
                            {insight.isNew ? (
                              <>es nuevo este mes: <Sensitive as="span">{money(insight.current)}</Sensitive>, antes no gastabas aquí.</>
                            ) : (
                              <>{up ? "subió" : "bajó"} un <strong className={up ? "text-amber-500" : "text-emerald-500"}>{Math.round(Math.abs(insight.deltaPct))}%</strong> frente a tu media (<Sensitive as="span">{money(Math.round(insight.average))}</Sensitive> → <Sensitive as="span">{money(insight.current)}</Sensitive>).</>
                            )}
                          </p>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              )}
            </div>
          </CollapsibleBlock>
        </>
      )}

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        onConfirm={() => dispatch({ type: "RESET" })}
        title="¿Borrar todos los datos?"
        description="Esta acción eliminará todas tus cuentas, transacciones y metas. No se puede deshacer."
        confirmLabel="Borrar todo"
        destructive
      />
    </div>
  )
}
