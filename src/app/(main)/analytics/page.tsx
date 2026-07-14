"use client"

import { useMemo, useState, memo } from "react"
import { BarChart, DonutChart } from "@tremor/react"
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BarChart3, Calendar, CalendarClock, ChevronLeft, ChevronRight, CircleDollarSign, FileDown, Gauge, Layers3, Lightbulb, PiggyBank, Sparkles, Target, TrendingDown, TrendingUp, Wallet, Wallet2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MetricCard } from "@/components/dashboard/metric-card"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { MountainChart } from "@/components/shared/mountain-chart"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { TickerTile } from "@/components/shared/ticker-tile"
import { accountGoal, buildMonthlyCashFlow, buildMonthlySummariesUpTo, buildNetWorthHistory, buildNetWorthHistoryDaily, getCategoryBreakdown, getCategoryInsights, getFinancialTips, getMonthTotalsByString, getNeedsVsWantsForMonth, getUpcomingRecurring, isTransfer } from "@/lib/calculations"
import { useFinance } from "@/lib/store"
import { usePortfolioValue, accountDisplayValue, useDisplayAccounts } from "@/lib/investments"
import { formatMoney } from "@/lib/currency"
import { money, signedMoney, chartFormatter, formatMonth, isInitialBalanceTransaction } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

// Mismo umbral que MonthlyBudget (src/components/dashboard/monthly-budget.tsx).
const BUDGET_WARNING_THRESHOLD = 80

const SummaryTooltip = createChartTooltip(["ingresos", "gastos"], ["emerald", "red"])
const CategoryTooltip = createChartTooltip(["monto"], ["violet"])
const AccountTooltip = createChartTooltip(["monto"], ["blue"])
const NeedsWantsTooltip = createChartTooltip(["Necesidades", "Deseos"], ["emerald", "amber"])

const SectionTitle = memo(function SectionTitle({ label, title, text }: { label: string; title: string; text?: string }) {
  return (
    <div className="col-span-full flex flex-col gap-1 pt-2">
      <p className="page-section-label">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {text && <p className="max-w-xl text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
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
  // Para los consejos: cuentas con el valor real (mercado) en inversión, la
  // misma cifra que el resto de widgets de la app.
  const displayAccounts = useDisplayAccounts()
  const [monthOffset, setMonthOffset] = useState(0)
  const [trendMonths, setTrendMonths] = useState<6 | 12>(6)

  const today = new Date()
  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasData = analysisTransactions.length > 0

  const [confirmReset, setConfirmReset] = useState(false)

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  // Misma fuente de reglas que Cuentas/Inversiones (getFinancialTips): la
  // recomendación del diagnóstico rápido deja de ser un único if/else propio
  // de esta página y pasa a ser el consejo de mayor severidad del motor.
  const tips = useMemo(
    () => getFinancialTips(analysisTransactions, displayAccounts, state.sinkingFunds, selectedMonth),
    [analysisTransactions, displayAccounts, state.sinkingFunds, selectedMonth]
  )
  const topTip = tips[0]
  const dailyTotals = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const totals = new Array(daysInMonth).fill(0)
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || isTransfer(t) || !t.fecha.startsWith(selectedMonth)) continue
      const day = new Date(t.fecha).getDate()
      totals[day - 1] += t.monto
    }
    return totals
  }, [analysisTransactions, selectedMonth])
  // getDay() da 0=domingo..6=sábado; se convierte a semana de lunes a domingo.
  const firstWeekday = (new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay() + 6) % 7
  const { necesidades, deseos } = useMemo(() => getNeedsVsWantsForMonth(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  // De qué cuenta sale el gasto del mes (no solo en qué categoría se va),
  // para detectar qué cuenta se vacía más rápido.
  const spendByAccount = useMemo(() => {
    const accountById = new Map(state.accounts.map((a) => [a.id, a]))
    const totals = new Map<string, number>()
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || isTransfer(t) || !t.fecha.startsWith(selectedMonth)) continue
      totals.set(t.cuenta_id, (totals.get(t.cuenta_id) ?? 0) + t.monto)
    }
    return Array.from(totals.entries())
      .map(([cuentaId, monto]) => ({ cuenta: accountById.get(cuentaId)?.nombre ?? "Cuenta eliminada", monto }))
      .sort((a, b) => b.monto - a.monto)
  }, [state.accounts, analysisTransactions, selectedMonth])
  const categoryInsights = useMemo(() => getCategoryInsights(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  // Mismo patrón que MonthlyBudget: un único pase agrupa el gasto por
  // categoría, en vez de recorrer transacciones una vez por presupuesto.
  const budgetProgress = useMemo(() => {
    const categoryById = new Map(state.categories.map((c) => [c.id, c]))
    const spentByCategory = new Map<string, number>()
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || !t.fecha.startsWith(selectedMonth)) continue
      spentByCategory.set(t.categoria, (spentByCategory.get(t.categoria) ?? 0) + t.monto)
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
  }, [state.budgets, state.categories, analysisTransactions, selectedMonth])
  const summaries = useMemo(() => buildMonthlySummariesUpTo(analysisTransactions, selectedMonth, trendMonths), [analysisTransactions, selectedMonth, trendMonths])
  const cashFlow = useMemo(() => buildMonthlyCashFlow(analysisTransactions, selectedMonth, trendMonths), [analysisTransactions, selectedMonth, trendMonths])
  const { valueByAccount, investedByAccount } = usePortfolioValue()
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
  const rawNetWorthHistory = useMemo(() => buildNetWorthHistory(state.transactions, state.accounts, selectedMonth, trendMonths), [state.transactions, state.accounts, selectedMonth, trendMonths])
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
  const categoryTotal = categoryBreakdown.reduce((sum, item) => sum + item.monto, 0)
  const topCategoryPct = topCategory && categoryTotal > 0 ? Math.round((topCategory.monto / categoryTotal) * 100) : 0
  // La ventana de cashFlow siempre tiene 6 meses aunque el usuario lleve
  // menos tiempo usando la app; los meses sin ningún movimiento (ni ingresos
  // ni gastos) no cuentan como "mes con cash flow positivo" ni entran en la
  // media, o si no se infla la racha/promedio con meses que nunca existieron.
  const activeCashFlow = useMemo(() => cashFlow.filter((item) => item.ingresos > 0 || item.gastos > 0), [cashFlow])
  const averageMonthlyNet = activeCashFlow.length > 0 ? Math.round(activeCashFlow.reduce((sum, item) => sum + item.neto, 0) / activeCashFlow.length) : 0
  const positiveMonths = activeCashFlow.filter((item) => item.neto >= 0).length
  const netWorthTrendPositive = netWorthChange >= 0
  // Pico diario real del mes en curso: la serie mensual solo tiene un punto
  // para este mes (el valor de hoy), así que sin esto la insignia "Máximo
  // histórico" se encendía aunque el patrimonio ya hubiera caído desde un
  // pico intramensual (mismo arreglo que el hero del Dashboard).
  const currentMonthDailyPeak = useMemo(() => {
    if (monthOffset !== 0) return 0
    const daily = buildNetWorthHistoryDaily(state.accounts, state.transactions, today.getDate(), today)
    return daily.reduce((m, d) => Math.max(m, d.patrimonio - investmentSaldo + investmentDisplayTotal), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset, state.accounts, state.transactions, investmentSaldo, investmentDisplayTotal])
  const isAllTimeHigh = netWorthTrendPositive && netWorthHistory.length > 0 && currentNetWorth >= Math.max(...netWorthHistory.map((n) => n.patrimonio), currentMonthDailyPeak)

  // Racha de meses consecutivos con flujo de caja positivo, contando hacia
  // atrás desde el mes seleccionado, ignorando los meses sin actividad.
  const streak = useMemo(() => {
    let count = 0
    for (let i = cashFlow.length - 1; i >= 0; i--) {
      const month = cashFlow[i]
      if (month.ingresos === 0 && month.gastos === 0) break
      if (month.neto < 0) break
      count++
    }
    return count
  }, [cashFlow])
  const savingsRateTrend = useMemo(() => cashFlow.map((c) => (c.ingresos > 0 ? Math.max((c.neto / c.ingresos) * 100, 0) : 0)), [cashFlow])

  const needsWantsData = [
    { name: "Necesidades", value: necesidades },
    { name: "Deseos", value: deseos },
  ]

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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Skeleton className="h-80" /><Skeleton className="h-80" />
          </div>
        </div>
      ) : (
      <>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Patrimonio" value={<AnimatedNumber value={Math.round(currentNetWorth)} />} subtitle={<>{netWorthTrendPositive ? "Sube" : "Baja"} <Sensitive>{signedMoney(netWorthChange)}</Sensitive> vs mes previo</>} icon={Wallet} tone={netWorthTrendPositive ? "emerald" : "red"} delay={0} />
        <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix={monthTotals.ingresos > 0 ? "+" : ""} />} subtitle={`Registrados en ${formatMonth(selectedDate)}`} icon={ArrowUpRight} tone="emerald" delay={70} />
        <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix={monthTotals.gastos > 0 ? "-" : ""} />} subtitle={topCategory ? `${topCategory.categoria} concentra el ${topCategoryPct}%` : "Sin gastos este mes"} icon={ArrowDownRight} tone="red" delay={140} />
        <MetricCard label="Neto" value={<AnimatedNumber value={monthTotals.neto} />} subtitle={activeCashFlow.length > 0 ? `${positiveMonths}/${activeCashFlow.length} meses con cash flow positivo` : "Sin histórico todavía"} icon={Activity} tone={monthTotals.neto >= 0 ? "blue" : "amber"} delay={210} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <TickerTile label="Tasa de ahorro" value={`${Math.round(savingsActual)}%`} valueColor="var(--primary)" trend={savingsRateTrend} trendColor="blue" />
        <TickerTile label="Racha positiva" value={streak > 0 ? `${streak} ${streak === 1 ? "mes" : "meses"}` : "—"} valueColor="var(--accent-amber)" />
        <TickerTile label="Cash flow medio" value={<Sensitive>{signedMoney(averageMonthlyNet)}</Sensitive>} valueColor={averageMonthlyNet >= 0 ? "var(--accent-green)" : "var(--accent-red)"} />
        <TickerTile label="Categoría top" value={topCategory ? `${topCategoryPct}%` : "—"} detail={topCategory?.categoria} valueColor="var(--gold)" />
      </section>

      <section className="grid grid-cols-12 gap-6">
        <SectionTitle label="Tendencia" title={`El pulso de los últimos ${trendMonths} meses`} text="Patrimonio histórico y evolución mensual para detectar si estás acumulando o drenando capital." />

        <Card className="stagger-fade hero-panel col-span-full xl:col-span-7" style={{ animationDelay: "80ms" }}>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-emerald-500" />Patrimonio neto
              {isAllTimeHigh && <span className="gold-badge rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Máximo histórico</span>}
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="range-tabs">
                {([6, 12] as const).map((m) => (
                  <button key={m} onClick={() => setTrendMonths(m)} data-active={trendMonths === m} className="range-tab">{m}M</button>
                ))}
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${netWorthTrendPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}><Sensitive>{signedMoney(netWorthChange)}</Sensitive></span>
            </div>
          </CardHeader>
          <CardContent>
            {state.accounts.length === 0 ? <EmptyState icon={Wallet} title="Sin patrimonio registrado" description="Crea cuentas para ver la evolución de tu riqueza neta." bordered className="h-full" /> : (
              <MountainChart data={netWorthHistory} index="mes" category="patrimonio" valueFormatter={chartFormatter} className="h-[310px]" />
            )}
          </CardContent>
        </Card>

        <Card className="stagger-fade col-span-full xl:col-span-5" style={{ animationDelay: "140ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold"><BarChart3 className="h-4 w-4 text-muted-foreground" />Ingresos vs gastos</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? <EmptyState icon={BarChart3} title="Aún no hay movimientos" description="Añade ingresos y gastos para comparar tu ritmo mensual." bordered className="h-full" /> : (
              <div role="img" aria-label="Gráfico de barras: ingresos y gastos mes a mes">
                <BarChart data={summaries} index="mes" categories={["ingresos", "gastos"]} colors={["emerald", "red"]} valueFormatter={chartFormatter} yAxisWidth={64} customTooltip={SummaryTooltip} className="h-[310px]" showAnimation />
              </div>
            )}
          </CardContent>
        </Card>

        <SectionTitle label="Gasto" title="Dónde se está yendo el dinero" text="El objetivo no es ver barras bonitas: es encontrar el agujero más grande primero." />

        {/* content-start: sin él, el grid estira estas dos tarjetas hasta igualar
            la altura de la columna derecha (5 tarjetas apiladas) y quedan con
            grandes zonas vacías bajo los gráficos. La altura de cada gráfico se
            calcula según sus barras reales (~44px por fila + eje) por lo mismo. */}
        <div className="col-span-full grid content-start gap-6 lg:col-span-7">
          <Card className="stagger-fade" style={{ animationDelay: "180ms" }}>
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
            <Card className="stagger-fade" style={{ animationDelay: "190ms" }}>
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
        </div>

        <div className="col-span-full grid gap-6 lg:col-span-5">
          {budgetProgress.length > 0 && (
            <Card className="stagger-fade" style={{ animationDelay: "200ms" }}>
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

          <Card className="stagger-fade" style={{ animationDelay: "230ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold"><Gauge className="h-4 w-4 text-amber-500" />Necesidades vs deseos</CardTitle>
            </CardHeader>
            <CardContent>
              {totalSpending === 0 ? <EmptyState icon={Gauge} title="Sin gastos este mes" description="La distribución aparecerá al registrar necesidades y deseos." bordered className="h-full" /> : (
                <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center lg:grid-cols-1 xl:grid-cols-[180px_1fr]">
                  <div role="img" aria-label={`Gráfico circular: ${Math.round(needsPct)}% necesidades, ${Math.round(wantsPct)}% deseos`}>
                    {/* valueFormatter también formatea la cifra del centro del donut: sin él,
                        Tremor pinta la suma cruda con colas de coma flotante ("888.30999..."). */}
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

          <Card className="stagger-fade" style={{ animationDelay: "280ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold"><PiggyBank className="h-4 w-4 text-blue-500" />Diagnóstico rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/20">
                <p className="text-xs text-muted-foreground">Cash flow medio {trendMonths} meses</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${averageMonthlyNet >= 0 ? "text-emerald-500" : "text-red-500"}`}><Sensitive>{signedMoney(averageMonthlyNet)}</Sensitive></p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/20">
                <p className="text-xs text-muted-foreground">Recomendación</p>
                <p className="mt-1 text-sm font-medium leading-6">{topTip?.message ?? (monthTotals.neto >= 0 ? "Buen mes. Mantén el ahorro automático y revisa si puedes subir aportaciones." : "Mes negativo. Revisa categorías grandes y congela gastos variables unos días.")}</p>
              </div>
            </CardContent>
          </Card>

          {goalProgress.length > 0 && (
            <Card className="stagger-fade" style={{ animationDelay: "295ms" }}>
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

          {upcomingRecurring.length > 0 && (
            <Card className="stagger-fade" style={{ animationDelay: "300ms" }}>
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

          {categoryInsights.length > 0 && (
            <Card className="stagger-fade" style={{ animationDelay: "310ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold"><Sparkles className="h-4 w-4 text-violet-500" />Lo que ha cambiado este mes</CardTitle>
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

        {monthTotals.gastos > 0 && (
          <Card className="stagger-fade col-span-full" style={{ animationDelay: "330ms" }}>
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

        <SectionTitle label="Sistema" title="Regla 50/30/20" text="No es una ley, es un mapa rápido para saber si el mes está equilibrado." />

        <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-3">
          <RuleCard label="50% Necesidades" target={50} actual={needsPct} value={necesidades} tone="var(--accent-green)" delay={100} />
          <RuleCard label="30% Deseos" target={30} actual={wantsPct} value={deseos} tone="var(--accent-amber)" delay={170} />
          <RuleCard label="20% Ahorro" target={20} actual={savingsActual} value={monthTotals.neto} tone="var(--accent-blue)" delay={240} />
        </div>

        <SectionTitle label="Detalle" title="Cash flow mensual" text="La tabla compacta para confirmar si la historia que cuentan los gráficos es real." />

        <Card className="stagger-fade col-span-full" style={{ animationDelay: "180ms" }}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Ingresos</TableHead>
                  <TableHead className="text-right">Gastos</TableHead>
                  <TableHead className="text-right">Neto</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!hasData ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-14"><EmptyState icon={CircleDollarSign} title="Sin cash flow" description="Registra movimientos para construir tu histórico mensual." bordered className="h-full" /></TableCell>
                  </TableRow>
                ) : (
                  cashFlow.slice().reverse().map((month) => (
                    <TableRow key={month.mes}>
                      <TableCell className="font-medium capitalize">{month.mes}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-500"><Sensitive>+{money(month.ingresos)}</Sensitive></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-500"><Sensitive>{month.gastos > 0 ? "-" : ""}{money(month.gastos)}</Sensitive></TableCell>
                      <TableCell className={`text-right font-bold tabular-nums ${month.neto >= 0 ? "text-emerald-500" : "text-red-500"}`}><Sensitive>{signedMoney(month.neto)}</Sensitive></TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${month.neto >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
                          {month.neto >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {month.neto >= 0 ? "Sano" : "Déficit"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
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
