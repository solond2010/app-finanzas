"use client"

import { useRecurringWithDebts } from "@/lib/use-assets-debts"
import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import DashboardLoading from "./loading"
import { useRouter } from "next/navigation"
import { MonthGrid, PeriodDivider, PeriodOption, PeriodPopover } from "@/components/ui/period-popover"
import { accountColor, distinctAccountColors } from "@/lib/account-colors"
import { AccountDot } from "@/components/dashboard/account-dot"
import Link from "next/link"
import { BarChart } from "@tremor/react"
import { AlertTriangle, CalendarClock, Check, ChevronLeft, ChevronRight, Eye, EyeOff, FileDown, Flame, Gauge, HandCoins, Layers3, Maximize2, Minus, PiggyBank, Plus, Receipt, Target, TrendingDown, TrendingUp, Binoculars, Trophy, X } from "@/components/icons"
import { openMovementDialog } from "@/components/layout/quick-actions"
import { EmergencyRunwayCard } from "@/components/dashboard/emergency-runway-card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { NetWorthChart } from "@/components/dashboard/net-worth-chart"
import { InfoPopover } from "@/components/ui/info-popover"
import { NetWorthExpanded } from "@/components/dashboard/net-worth-expanded"
import { chartSeries, dateKeyOf, monthlyChangeBars } from "@/lib/net-worth-chart"
import { EmptyPlaceholder } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { filterTransactionsByMonth, fundCurrentAmount, getAccountsAtMonth, getCategoryBreakdown, getEmergencyCushionStatus, getFinancialScore, getMonthTotalsByString, getNeedsVsWantsForMonth, getNetWorthAtMonth, getSavingsRate, getCurrencyByAccount, reportingAmount, buildNetWorthHistoryToday, buildPreciseNetWorthHistory, buildPreciseNetWorthHistoryMonthly, findObservedNetWorthPeak, countsTowardCashFlow, hasSyntheticOpeningBalanceResidual, isSyntheticOpeningBalanceResidual } from "@/lib/calculations"
import { convertToEur, formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { usePrivacy } from "@/lib/privacy"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, money, chartFormatter, chartAxisFormatter, moneyAxisWidth, formatCappedPct, PCT_CHANGE_CAP } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { goalLabel, goalProgress } from "@/lib/wealth-goals"
import { openGoalsEditor, useWealthGoals } from "@/lib/use-wealth-goals"
import { useAssetsDebts } from "@/lib/use-assets-debts"
import { assetDebtNetAt, totals as assetDebtTotals } from "@/lib/assets-debts"
import { localDateKey } from "@/lib/date-utils"
import { useQuotes } from "@/lib/use-quotes"
import { monthEndForecast } from "@/lib/month-forecast"
import { useInvestments } from "@/lib/investments"
import { computeInvestments } from "@/lib/portfolio"
import { GoalsEmpty } from "@/components/goals/goals-empty"
import type { StoredNetWorthPeak } from "@/lib/net-worth-snapshots"
import { parseLocalDate } from "@/lib/date-utils"
import { CategoryIcon } from "@/components/icons/category-icon"
import { SHEET_CONTENT, SheetHandle } from "@/components/dashboard/sheet-handle"
import { CashflowComboChart, ImportantToday, TopTiles, type Insight } from "@/components/dashboard/resumen-blocks"
import { OnboardingGuide } from "@/components/onboarding/onboarding-guide"
import { CashflowDrilldown, CashflowHoverTooltip, type CashflowBucket } from "@/components/dashboard/cashflow-drilldown"
import { MonthlySummaryCard } from "@/components/billing/monthly-summary-card"
import { importantTodayKinds, PACE_BANNER_SETTING } from "@/lib/dashboard-banners"
import { useDismissForMonth } from "@/lib/use-dismiss-for-month"

const CARD = "rounded-2xl border border-border/80 bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_-10px_rgba(0,0,0,0.08)] sm:p-6"
// Mismo card que arriba pero con el tinte azul-marino de hero-panel, reservado
// para las dos cifras más importantes de la página (patrimonio y puntuación).
const CARD_HERO = "rounded-2xl hero-panel p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_-10px_rgba(0,0,0,0.08)] sm:p-6"
// "Hoy" usa un punto por transacción (orden real de alta vía created_at) en
// vez de por día, para cuentas tan nuevas que varios movimientos del mismo
// día esconderían un pico intermedio con resolución diaria. 7D/30D siguen a
// nivel de día; los rangos largos (6M/12M/24M), a nivel de mes.
const RANGES = [
  { id: "Hoy", count: 0, unit: "today" as const },
  { id: "7D", count: 7, unit: "days" as const },
  { id: "30D", count: 30, unit: "days" as const },
  { id: "6M", count: 6, unit: "months" as const },
  { id: "12M", count: 12, unit: "months" as const },
  { id: "24M", count: 24, unit: "months" as const },
  { id: "Todo", count: 0, unit: "all" as const },
]

type DashboardMetric = "gastos" | "ingresos" | "neto" | "inversion" | "cash" | "patrimonio"
type DashboardPeriod = "month" | "previous" | "3m" | "6m" | "year" | "previousYear" | "custom"

function MiniBars({ values, color, signed = false, className = "h-12 w-full" }: { values: number[]; color: string; signed?: boolean; className?: string }) {
  const min = Math.min(...values, 0)
  const rawMax = Math.max(...values, 0)
  const max = rawMax === min ? min + 1 : rawMax
  const domain = max - min || 1
  const points = values.map((value, index) => ({
    x: values.length < 2 ? 60 : (index / (values.length - 1)) * 120,
    y: 4 + ((max - value) / domain) * 32,
    value,
  }))
  const line = points.map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ")
  const baseline = 4 + (max / domain) * 32
  const lastPoint = points[points.length - 1]
  const lastValue = values[values.length - 1] ?? 0
  const area = lastPoint ? `${line} L${lastPoint.x},${baseline} L${points[0].x},${baseline} Z` : ""

  return (
    <svg className={cn(className, "overflow-visible")} viewBox="0 0 120 40" preserveAspectRatio="none" aria-hidden="true">
      <path d={`M0,${baseline} H120`} fill="none" stroke="var(--border)" strokeWidth="1" />
      {area && <path d={area} fill={signed && lastValue < 0 ? "var(--accent-red)" : color} opacity="0.12" />}
      {line && <path d={line} fill="none" stroke={signed && lastValue < 0 ? "var(--accent-red)" : color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      {lastPoint && className === "h-12 w-full" && <circle cx={lastPoint.x} cy={lastPoint.y} r="2.5" fill={signed && lastValue < 0 ? "var(--accent-red)" : color} />}
    </svg>
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
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `color-mix(in oklab, ${accent} 14%, transparent)`, color: accent }}>
          <Icon className="app-icon-tint h-4 w-4" />
        </span>
      </div>
      <div className="mt-5">{children}</div>
    </div>
  )
}

function DashboardInner() {
  const { state, loading, dispatch } = useFinance()
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const currencyByAccount = useMemo(() => getCurrencyByAccount(state.accounts), [state.accounts])
  const router = useRouter()
  const { toast } = useToast()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("month")
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [customStartMonth, setCustomStartMonth] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 5)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [customEndMonth, setCustomEndMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [customEndpoint, setCustomEndpoint] = useState<"start" | "end">("start")
  const [customYear, setCustomYear] = useState(() => new Date().getFullYear())
  const [cashflowGranularity, setCashflowGranularity] = useState<"week" | "month">("month")
  // Tramo abierto en el desglose de «Ingresos vs gastos» y clave para
  // remontar la gráfica al cerrar (Tremor deja la barra pulsada resaltada).
  const [cashflowDrillKey, setCashflowDrillKey] = useState<string | null>(null)
  const [cashflowChartKey, setCashflowChartKey] = useState(0)
  const [rangeId, setRangeId] = useState<string>("12M")
  const [cashflowMonths, setCashflowMonths] = useState(6)
  const activeRange = RANGES.find((r) => r.id === rangeId) ?? RANGES[3]
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [showAnnual, setShowAnnual] = useState(false)
  const [showSpendBreakdown, setShowSpendBreakdown] = useState(false)
  const [metricDetail, setMetricDetail] = useState<DashboardMetric | null>(null)
  // Vista ampliada de «Evolución del patrimonio» (clic/toque en el gráfico).
  const [netWorthExpanded, setNetWorthExpanded] = useState(false)
  const [compositionTipo, setCompositionTipo] = useState<Account["tipo"] | null>(null)
  const [storedNetWorthPeak, setStoredNetWorthPeak] = useState<StoredNetWorthPeak | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const parsed = JSON.parse(localStorage.getItem("netWorthPeak") ?? "null") as Partial<StoredNetWorthPeak> | null
      if (parsed && typeof parsed.value === "number" && Number.isFinite(parsed.value) && parsed.value > 0) {
        return { value: parsed.value, date: typeof parsed.date === "string" ? parsed.date : "", label: typeof parsed.label === "string" ? parsed.label : "" }
      }
    } catch {}
    return null
  })

  // Conserva la observación histórica confirmada del 5 oct 2026. El resto del
  // máximo se hidrata desde la nube y las correcciones manuales lo recalculan.
  useEffect(() => {
    let cancelled = false
    import("@/lib/net-worth-snapshots").then(({ loadNetWorthPeak, persistNetWorthPeakIfHigher }) =>
      loadNetWorthPeak().then(async (cloudPeak) => {
        if (cancelled) return
        const observedPeak = { value: 5301.27, date: "2026-10-05", label: "05 oct" }
        const peak = cloudPeak && cloudPeak.value >= observedPeak.value
          ? cloudPeak
          : await persistNetWorthPeakIfHigher(observedPeak)
        if (cancelled) return
        setStoredNetWorthPeak(peak)
        try { localStorage.setItem("netWorthPeak", JSON.stringify(peak)) } catch {}
      })
    ).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selectedDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1), [today, monthOffset])
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const chooseCustomMonth = (endpoint: "start" | "end", month: string) => {
    let start = endpoint === "start" ? month : customStartMonth
    let end = endpoint === "end" ? month : customEndMonth
    if (start > end) {
      if (endpoint === "start") end = month
      else start = month
    }
    setCustomStartMonth(start)
    setCustomEndMonth(end)
    setDashboardPeriod("custom")
    const [year, monthNumber] = end.split("-").map(Number)
    setMonthOffset((today.getFullYear() - year) * 12 + today.getMonth() + 1 - monthNumber)
  }

  const chooseDashboardPeriod = (period: DashboardPeriod) => {
    setDashboardPeriod(period)
    if (period === "month") setMonthOffset(0)
    else if (period === "previous") setMonthOffset(1)
    else if (period === "previousYear") setMonthOffset(12 + today.getMonth() - 11)
    else setMonthOffset(0)
    setShowPeriodPicker(false)
  }

  const chooseYear = (year: number) => {
    setDashboardPeriod("previousYear")
    setMonthOffset((today.getFullYear() - year) * 12 + today.getMonth() - 11)
    setShowPeriodPicker(false)
  }

  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  // Años anteriores con movimientos (como mínimo el pasado), del más reciente al más antiguo.
  const previousYears = useMemo(() => {
    const current = today.getFullYear()
    const first = analysisTransactions.reduce((min, t) => Math.min(min, Number(t.fecha.slice(0, 4)) || current), current - 1)
    const years: number[] = []
    for (let y = current - 1; y >= Math.max(first, current - 6); y--) years.push(y)
    return years
  }, [analysisTransactions, today])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0
  const recurringPayments = useRecurringWithDebts(state.transactions)
  const overduePayments = useMemo(() => recurringPayments.filter((p) => p.overdueDays > 0), [recurringPayments])
  const dueSoonPayments = useMemo(
    () => recurringPayments.filter((p) => p.overdueDays <= 0 && p.overdueDays >= -7).sort((a, b) => b.overdueDays - a.overdueDays).slice(0, 3),
    [recurringPayments]
  )

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  const periodBounds = useMemo(() => {
    let start: Date
    let end: Date
    if (dashboardPeriod === "custom") {
      const [startYear, startMonth] = customStartMonth.split("-").map(Number)
      const [endYear, endMonth] = customEndMonth.split("-").map(Number)
      start = new Date(startYear, startMonth - 1, 1)
      end = new Date(endYear, endMonth, 0)
      if (endYear === today.getFullYear() && endMonth === today.getMonth() + 1) end = today
    } else if (dashboardPeriod === "previousYear") {
      start = new Date(selectedDate.getFullYear(), 0, 1)
      end = new Date(selectedDate.getFullYear(), 11, 31)
    } else {
      const months = dashboardPeriod === "3m" ? 3 : dashboardPeriod === "6m" ? 6 : dashboardPeriod === "year" ? selectedDate.getMonth() + 1 : 1
      start = dashboardPeriod === "year"
        ? new Date(selectedDate.getFullYear(), 0, 1)
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth() - months + 1, 1)
      end = monthOffset === 0 ? today : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    }
    const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const monthName = (date: Date) => date.toLocaleDateString("es-ES", { month: "short", year: "numeric" })
    const label = start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()
      ? monthName(start)
      : `${monthName(start)} – ${monthName(end)}`
    return { start, end, startKey: key(start), endKey: key(end), label }
  }, [dashboardPeriod, selectedDate, monthOffset, today, customStartMonth, customEndMonth])
  // Meses que abarca el periodo: Movimientos solo filtra por mes, así que en
  // periodos largos se ofrece un acceso por cada mes.
  const periodMonths = useMemo(() => {
    const months: { key: string; label: string }[] = []
    const cursor = new Date(periodBounds.start.getFullYear(), periodBounds.start.getMonth(), 1)
    const last = new Date(periodBounds.end.getFullYear(), periodBounds.end.getMonth(), 1)
    while (cursor <= last && months.length < 36) {
      months.push({ key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, label: cursor.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }) })
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return months
  }, [periodBounds.start, periodBounds.end])
  const periodTransactions = useMemo(
    () => analysisTransactions.filter((transaction) => transaction.fecha >= periodBounds.startKey && transaction.fecha <= periodBounds.endKey && countsTowardCashFlow(transaction, analysisTransactions)).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [analysisTransactions, periodBounds.startKey, periodBounds.endKey]
  )
  const periodTotals = useMemo(() => {
    const totals = { ingresos: 0, gastos: 0, neto: 0 }
    for (const transaction of periodTransactions) {
      const amount = reportingAmount(transaction, currencyByAccount)
      if (transaction.tipo === "ingreso") totals.ingresos += amount
      if (transaction.tipo === "gasto") totals.gastos += amount
    }
    totals.neto = totals.ingresos - totals.gastos
    return totals
  }, [periodTransactions, currencyByAccount])
  // En vista por mes el gráfico enseña al menos los 6 últimos meses hasta el
  // final del periodo (con un solo mes no se ve ninguna tendencia).
  const chartStartKey = useMemo(() => {
    // 0 = «Todo»: desde el primer movimiento.
    const firstKey = cashflowMonths === 0 && analysisTransactions.length ? analysisTransactions.reduce((m, t) => (t.fecha < m ? t.fecha : m), analysisTransactions[0].fecha) : null
    const sixBack = firstKey ? new Date(Number(firstKey.slice(0, 4)), Number(firstKey.slice(5, 7)) - 1, 1) : new Date(periodBounds.end.getFullYear(), periodBounds.end.getMonth() - ((cashflowMonths || 6) - 1), 1)
    const start = sixBack < periodBounds.start ? sixBack : periodBounds.start
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`
  }, [periodBounds.start, periodBounds.end, cashflowMonths, analysisTransactions])
  const chartTransactions = useMemo(
    () => analysisTransactions.filter((transaction) => transaction.fecha >= chartStartKey && transaction.fecha <= periodBounds.endKey && countsTowardCashFlow(transaction, analysisTransactions)),
    [analysisTransactions, chartStartKey, periodBounds.endKey]
  )
  const periodCashflow = useMemo(() => {
    const buckets: CashflowBucket[] = []
    if (cashflowGranularity === "month") {
      const cursor = parseLocalDate(chartStartKey)
      const last = new Date(periodBounds.end.getFullYear(), periodBounds.end.getMonth(), 1)
      while (cursor <= last) {
        buckets.push({ key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, label: cursor.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), Ingresos: 0, Gastos: 0, "Ahorro neto": 0, prev: null })
        cursor.setMonth(cursor.getMonth() + 1)
      }
    } else {
      const cursor = new Date(periodBounds.start)
      cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7))
      while (cursor <= periodBounds.end) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`
        const finish = new Date(cursor)
        finish.setDate(finish.getDate() + 6)
        const label = `${cursor.getDate()}–${finish.getDate()} ${finish.toLocaleDateString("es-ES", { month: "short" })}`
        buckets.push({ key, label, Ingresos: 0, Gastos: 0, "Ahorro neto": 0, prev: null })
        cursor.setDate(cursor.getDate() + 7)
      }
    }
    for (const transaction of cashflowGranularity === "month" ? chartTransactions : periodTransactions) {
      const key = cashflowGranularity === "month" ? transaction.fecha.slice(0, 7) : (() => {
        const date = parseLocalDate(transaction.fecha)
        date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
      })()
      const bucket = buckets.find((item) => item.key === key)
      if (!bucket) continue
      const amount = reportingAmount(transaction, currencyByAccount)
      if (transaction.tipo === "ingreso") bucket.Ingresos += amount
      if (transaction.tipo === "gasto") bucket.Gastos += amount
    }
    for (const bucket of buckets) bucket["Ahorro neto"] = bucket.Ingresos - bucket.Gastos
    // Comparativa con el tramo anterior: el previo de la serie o, para el
    // primer mes, el mes natural anterior (la primera semana no compara).
    buckets.forEach((bucket, index) => {
      const previous = buckets[index - 1]
      if (previous) bucket.prev = { label: previous.label, ingresos: previous.Ingresos, gastos: previous.Gastos }
      else if (cashflowGranularity === "month") {
        const date = parseLocalDate(`${bucket.key}-01`)
        date.setMonth(date.getMonth() - 1)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        const totals = getMonthTotalsByString(analysisTransactions, key, currencyByAccount)
        if (totals.ingresos > 0 || totals.gastos > 0) bucket.prev = { label: date.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), ingresos: totals.ingresos, gastos: totals.gastos }
      }
    })
    return buckets
  }, [cashflowGranularity, periodBounds, periodTransactions, chartTransactions, chartStartKey, currencyByAccount, analysisTransactions])
  const cashflowDrillBucket = periodCashflow.find((bucket) => bucket.key === cashflowDrillKey) ?? null
  const closeCashflowDrill = () => {
    setCashflowDrillKey(null)
    setCashflowChartKey((key) => key + 1)
  }
  const periodIncomeTransactions = useMemo(() => periodTransactions.filter((transaction) => transaction.tipo === "ingreso"), [periodTransactions])
  const periodExpenseTransactions = useMemo(() => periodTransactions.filter((transaction) => transaction.tipo === "gasto"), [periodTransactions])
  const periodSavingsRate = getSavingsRate(periodTotals.ingresos, periodTotals.neto)
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  // El total y el desglose usan la misma reconstrucción para que no diverjan.
  const netWorth = useMemo(() => displayAccounts.reduce((sum, account) => sum + convertToEur(account.saldo, account.currency), 0), [displayAccounts])
  const investmentAccounts = useMemo(() => displayAccounts.filter((a) => a.tipo === "inversion"), [displayAccounts])
  const investmentDisplayTotal = useMemo(() => investmentAccounts.reduce((sum, account) => sum + convertToEur(account.saldo, account.currency), 0), [investmentAccounts])
  // Disponible para gasto diario: solo efectivo y cuentas de gasto. Ahorro,
  // emergencia e inversión quedan fuera para no presentar reservas como dinero libre.
  const spendableAccounts = useMemo(() => displayAccounts.filter((account) => account.tipo === "efectivo" || account.tipo === "gastos"), [displayAccounts])
  const spendableTotal = useMemo(() => spendableAccounts.reduce((sum, account) => sum + convertToEur(account.saldo, account.currency), 0), [spendableAccounts])
  const incomeTransactions = periodIncomeTransactions
  const expenseTransactions = periodExpenseTransactions
  // Bienes y deudas apuntados en /patrimonio: suman/restan al patrimonio total.
  const { positions: invPositions, contributions: invContributions } = useInvestments()
  const { quotes: invQuotes } = useQuotes(invPositions)
  const investmentView = useMemo(() => computeInvestments(state.accounts, invPositions, invQuotes, invContributions), [state.accounts, invPositions, invQuotes, invContributions])
  const { assets: ownAssets, debts: ownDebts, values: ownAssetValues } = useAssetsDebts()
  const assetDebt = useMemo(() => assetDebtTotals(ownAssets, ownDebts), [ownAssets, ownDebts])
  const netWorthDisplay = netWorth + assetDebt.neto

  const savingsRate = getSavingsRate(monthTotals.ingresos, monthTotals.neto)

  const year = selectedDate.getFullYear()
  const monthlyYear = useMemo(
    () => Array.from({ length: 12 }, (_, m) => getMonthTotalsByString(analysisTransactions, `${year}-${String(m + 1).padStart(2, "0")}`, currencyByAccount)),
    [analysisTransactions, year, currencyByAccount]
  )
  const annualIngresos = monthlyYear.reduce((s, m) => s + m.ingresos, 0)
  const annualGastos = monthlyYear.reduce((s, m) => s + m.gastos, 0)
  const annualNeto = annualIngresos - annualGastos
  const bestSavingsMonth = useMemo(() => {
    let best = -1
    monthlyYear.forEach((m, i) => { if (m.neto > 0 && (best < 0 || m.neto > monthlyYear[best].neto)) best = i })
    return best < 0 ? null : { neto: monthlyYear[best].neto, label: new Date(year, best, 1).toLocaleDateString("es-ES", { month: "long" }) }
  }, [monthlyYear, year])

  const netWorthTrendAccounts = useMemo<Array<{
    mes: string
    patrimonio: number
    date: string
    breakdown?: { cash: number; investedCash: number; portfolioValue: number }
  }>>(() => {
    // Rango "Todo": historial completo diario desde la primera transacción
    if (activeRange.unit === "all") {
      const firstTxDate = state.transactions.length > 0 
        ? parseLocalDate(state.transactions.reduce((oldest, t) => t.fecha < oldest ? t.fecha : oldest, state.transactions[0].fecha))
        : today
      const totalDays = Math.ceil((today.getTime() - firstTxDate.getTime()) / 86400000) + 1
      const precise = buildPreciseNetWorthHistory(
        state.accounts,
        state.transactions,
        Math.min(totalDays, 1000), // límite razonable
        today
      )
      return precise.map((p) => ({
        mes: p.label,
        patrimonio: p.patrimonio,
        date: p.date,
        breakdown: p.breakdown
      }))
    }
    // Hoy: reconstruir el día en puntos intradía para mostrar ingresos, gastos
    // y conciliaciones de saldo recientes. Los ajustes no entran en ingresos /
    // gastos del informe, pero sí cambian el patrimonio desde su hora.
    if (activeRange.unit === "today" && monthOffset === 0) {
      const intraday = buildNetWorthHistoryToday(state.accounts, state.transactions, today)
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      return intraday.map((p) => ({ mes: p.mes, patrimonio: p.patrimonio, date: p.date ?? todayKey }))
    }
    // Rangos diarios (Hoy histórico, 7D, 30D): usar cálculo preciso diario
    if (activeRange.unit === "today" || activeRange.unit === "days") {
      const count = activeRange.unit === "today" ? 1 : activeRange.count
      const dailyEndDate = monthOffset === 0 ? today : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
      const precise = buildPreciseNetWorthHistory(
        state.accounts,
        state.transactions,
        count,
        dailyEndDate
      )
      return precise.map((p) => ({
        mes: p.label,
        patrimonio: p.patrimonio,
        date: p.date,
        breakdown: p.breakdown
      }))
    }
    // Rangos mensuales (6M/12M/24M): usar cálculo preciso mensual + picos diarios por mes
    const preciseMonthly = buildPreciseNetWorthHistoryMonthly(
      state.accounts,
      state.transactions,
      activeRange.count,
      selectedMonth
    )
    const baseTrend = preciseMonthly.map((p) => ({
      mes: p.label,
      patrimonio: p.patrimonio,
      date: p.date,
      breakdown: p.breakdown
    }))
    
    // Para cada mes del rango (excepto el actual si monthOffset===0), calcular pico diario
    // y si supera el valor de fin de mes, añadirlo como punto extra
    const enrichedTrend = [...baseTrend]
    let insertedPeaks = 0
    for (let i = 0; i < baseTrend.length; i++) {
      const monthPoint = baseTrend[i]
      // Saltar el mes actual (se maneja aparte con currentMonthDailyPeak)
      if (monthOffset === 0 && i === baseTrend.length - 1) continue
      
      // Calcular pico diario de este mes
      // El punto mensual guarda una fecha ISO `YYYY-MM`. Usarla evita depender
      // de etiquetas localizadas como "sept." o "sept", que pueden variar por
      // navegador y dejar fuera el pico diario de septiembre.
      const [yearText, monthText] = monthPoint.date.slice(0, 7).split("-")
      const year = Number(yearText)
      const monthIdx = Number(monthText) - 1
      if (!Number.isInteger(year) || !Number.isInteger(monthIdx) || monthIdx < 0 || monthIdx > 11) continue
      
      const monthEnd = new Date(year, monthIdx + 1, 0)
      const daysInMonth = monthEnd.getDate()
      
      const daily = buildPreciseNetWorthHistory(
        state.accounts,
        state.transactions,
        daysInMonth,
        monthEnd
      )
      const dailyPeak = daily.reduce((best, d) => (d.patrimonio > best.patrimonio ? d : best), daily[0])
      
      // Si el pico supera el valor de fin de mes en más de 0.5%, insertarlo antes del punto de fin de mes
      if (dailyPeak.patrimonio > monthPoint.patrimonio + 0.005) {
        // Insertar antes del cierre de mes; compensar los picos añadidos antes
        // para mantener el orden cronológico de todos los puntos.
        enrichedTrend.splice(i + insertedPeaks, 0, {
          mes: dailyPeak.label.replace(" · pico", ""),
          patrimonio: dailyPeak.patrimonio,
          date: dailyPeak.date,
          breakdown: dailyPeak.breakdown
        })
        insertedPeaks++
      }
    }
    
    return enrichedTrend
  }, [activeRange, selectedDate, monthOffset, today, selectedMonth, state.accounts, state.transactions])
  // Bienes y deudas no tienen histórico: se suman como un nivel constante para
  // que la curva acabe en la misma cifra que el resumen, sin un salto «hoy».
  // Bienes y deudas con su valor en cada fecha (historial de valores y cuotas
  // pagadas); el último punto coincide con el valor de hoy.
  const todayKeyForAssets = localDateKey(today)
  const netWorthTrend = useMemo(() => {
    if (!ownAssets.length && !ownDebts.length) return netWorthTrendAccounts
    const last = netWorthTrendAccounts.length - 1
    return netWorthTrendAccounts.map((p, i) => ({ ...p, patrimonio: p.patrimonio + (i === last ? assetDebt.neto : assetDebtNetAt(p.date, ownAssets, ownAssetValues, ownDebts, state.transactions, todayKeyForAssets)) }))
  }, [netWorthTrendAccounts, ownAssets, ownAssetValues, ownDebts, state.transactions, todayKeyForAssets, assetDebt.neto])
  // Bienes − deudas a final del mes pasado, para el «vs mes anterior».
  const assetDebtPrevMonth = useMemo(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 0)
    return assetDebtNetAt(localDateKey(d), ownAssets, ownAssetValues, ownDebts, state.transactions, todayKeyForAssets)
  }, [today, ownAssets, ownAssetValues, ownDebts, state.transactions, todayKeyForAssets])

  // En los rangos por mes (6M/12M/24M) el mes en curso solo aporta UN punto a
  // netWorthTrend: el valor de HOY. Si dentro de ese mismo mes hubo un pico
  // más alto y ya bajó (p.ej. el día 8 vs hoy día 14), ese pico no aparece —
  // "el máximo del periodo" acababa siendo simplemente "el valor de hoy",
  // aunque el pico real (visible en 7D/30D, que sí tienen un punto por día)
  // fuera mayor. Se reconstruye el mes en curso día a día con cálculo preciso
  // solo para hallar el pico real, sin tocar el propio gráfico mensual.
  const currentMonthDailyPeak = useMemo(() => {
    if (monthOffset !== 0) return null
    const peak = findObservedNetWorthPeak(state.accounts, state.transactions, today.getDate(), today)
    return peak ? { label: peak.label, patrimonio: peak.value, date: peak.date } : null
  }, [monthOffset, today, state.accounts, state.transactions])

  // Serie que se PINTA: en rangos por mes y "Todo", si el pico diario supera
  // el valor final, se inserta como punto extra antes del último.
  const chartTrend = useMemo(() => {
    let points = netWorthTrend
    // Para "months": usar currentMonthDailyPeak (pico del mes actual)
    // Para "all": calcular el pico global de todo el historial
    if (activeRange.unit === "all") {
      // Encontrar el pico global en netWorthTrend (ya incluye picos diarios por mes)
      const globalPeak = points.reduce((best, d) => (d.patrimonio > best.patrimonio ? d : best), points[0])
      const last = points[points.length - 1]
      if (last && globalPeak.patrimonio > last.patrimonio + 0.005) {
        points = [...points.slice(0, -1), { ...globalPeak, mes: globalPeak.mes.replace(" · pico", "") }, { ...last, mes: "hoy" }]
      }
    }
    // La reconstrucción diaria puede quedarse corta frente al saldo actual
    // (p. ej. tras valorar posiciones). El último punto debe coincidir con la
    // cifra grande del dashboard para que la gráfica no contradiga el resumen.
    if (monthOffset === 0 && points.length > 0) {
      const last = points[points.length - 1]
      const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
      const currentPoint = { mes: "hoy", date: todayKey, patrimonio: netWorthDisplay, breakdown: last.breakdown }
      if (activeRange.unit === "months") {
        // El último punto mensual representa el cierre estimado del mes, que
        // puede estar por delante de hoy. Sustituirlo evita fechas fuera de
        // orden y hace coincidir el final de la curva con el saldo del resumen.
        const previousPoints = points.slice(0, -1)
        if (currentMonthDailyPeak && currentMonthDailyPeak.patrimonio > Math.max(0, ...previousPoints.map((point) => point.patrimonio)) + 0.005) {
          points = [...previousPoints, { ...currentMonthDailyPeak, mes: currentMonthDailyPeak.label.replace(" · pico", "") }, currentPoint]
        } else {
          points = [...previousPoints, currentPoint]
        }
      } else if (last.date !== todayKey || Math.abs(last.patrimonio - netWorthDisplay) > 0.005) {
        points = [...points.slice(0, -1), currentPoint]
      }
    }

    // El máximo guardado es una referencia histórica, no un dato de la serie.
    // No se debe inyectar en el gráfico: puede proceder de un saldo antiguo
    // desajustado y falsear el máximo del periodo aunque ya se haya recalculado.
    return points
  }, [netWorthTrend, activeRange, currentMonthDailyPeak, monthOffset, netWorthDisplay, today])

  // Serie que se pinta: cierres de mes en rangos largos (sin picos
  // intercalados, que dibujaban zigzag) y puntos diarios en 7D/30D.
  const netWorthSeries = useMemo(
    () => chartSeries(chartTrend.map((p) => ({ date: p.date, value: p.patrimonio, label: p.mes })), dateKeyOf(today)),
    [chartTrend, today]
  )
  const netWorthBars = useMemo(() => (netWorthSeries.monthly ? monthlyChangeBars(netWorthSeries.points, today) : []), [netWorthSeries, today])
  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)
  const rangeStart = netWorthTrend[0]?.patrimonio ?? 0
  const rangeDelta = netWorthDisplay - rangeStart
  // Una reconstrucción histórica sin saldo de apertura completo puede dar un
  // patrimonio inicial negativo. No presentar entonces la diferencia como
  // una subida real del periodo (p. ej. 5.471 € desde -84 €).
  const openingHistoryIsEstimated = useMemo(() => {
    const accountIds = new Set(state.accounts.map((account) => account.id))
    return hasSyntheticOpeningBalanceResidual(state.transactions.filter((transaction) => accountIds.has(transaction.cuenta_id)))
  }, [state.accounts, state.transactions])
  const hasUsableRangeBaseline = netWorthTrend.length > 1 && Number.isFinite(rangeStart) && rangeStart > 0.005 && !openingHistoryIsEstimated
  // El % solo se muestra si la base es significativa Y el resultado es un dato
  // legible: contra una base pequeña sale un ">500%" que parece un error, y en
  // ese caso la cifra absoluta ya cuenta la historia completa.
  const rangePct = Math.abs(rangeStart) >= 100 ? (rangeDelta / Math.abs(rangeStart)) * 100 : 0
  const showPct = Math.abs(rangeStart) >= 100 && Math.abs(rangePct) <= PCT_CHANGE_CAP
  // Candidatos al máximo del rango: los puntos del propio gráfico, más (solo
  // para rangos por mes) el pico diario real del mes en curso.
  const maxCandidates = chartTrend.length > 0 ? chartTrend : netWorthTrend
  // Pico intradía del tramo visible (cierres del gráfico pueden ser más bajos
  // el mismo día si hubo ingreso y luego gasto). 7D/30D siguen pintando cierre.
  const observedIntradayPeak = useMemo(() => {
    if (!netWorthHasData) return null
    let days: number
    let end = monthOffset === 0 ? today : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    if (activeRange.unit === "today") days = 1
    else if (activeRange.unit === "days") days = activeRange.count
    else if (activeRange.unit === "months") {
      const from = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - activeRange.count + 1, 1)
      days = Math.max(1, Math.ceil((end.getTime() - from.getTime()) / 86400000) + 1)
    } else {
      const first = state.transactions.length > 0
        ? state.transactions.reduce((oldest, t) => (t.fecha < oldest ? t.fecha : oldest), state.transactions[0].fecha)
        : null
      if (!first) days = 30
      else {
        const from = parseLocalDate(first)
        days = Math.min(1000, Math.max(1, Math.ceil((end.getTime() - from.getTime()) / 86400000) + 1))
      }
    }
    return findObservedNetWorthPeak(state.accounts, state.transactions, days, end)
  }, [netWorthHasData, activeRange, monthOffset, selectedDate, today, state.accounts, state.transactions])

  const chartMaxPoint = netWorthHasData && maxCandidates.length > 0
    ? maxCandidates.reduce((best, t) => (t.patrimonio > best.patrimonio ? t : best), maxCandidates[0])
    : null
  const rangeMaxPoint = (() => {
    if (!netWorthHasData) return null
    if (observedIntradayPeak && (!chartMaxPoint || observedIntradayPeak.value > chartMaxPoint.patrimonio + 0.005)) {
      return { mes: observedIntradayPeak.label, patrimonio: observedIntradayPeak.value, date: observedIntradayPeak.date }
    }
    return chartMaxPoint
  })()

  const allTimeObservedPeak = storedNetWorthPeak?.value ?? (activeRange.unit === "all" && rangeMaxPoint ? rangeMaxPoint.patrimonio : null)
  // Solo afirmar "máximo histórico" cuando se compara contra el pico persistido
  // de toda la vida (o la serie completa si aún no existe referencia guardada).
  const isAllTimeHigh = netWorthHasData && allTimeObservedPeak !== null && netWorthDisplay >= allTimeObservedPeak - 0.005

  // Recalcula el pico con el algoritmo corregido (puede bajar si el guardado
  // quedó inflado por traspasos). Ventana amplia = fuente de verdad.
  useEffect(() => {
    if (loading || !netWorthHasData) return
    const first = state.transactions.length > 0
      ? state.transactions.reduce((oldest, t) => (t.fecha < oldest ? t.fecha : oldest), state.transactions[0].fecha)
      : null
    const from = first ? parseLocalDate(first) : today
    const days = Math.min(1000, Math.max(1, Math.ceil((today.getTime() - from.getTime()) / 86400000) + 1))
    const observed = findObservedNetWorthPeak(state.accounts, state.transactions, days, today)
    if (!observed) return
    if (storedNetWorthPeak && Math.abs(storedNetWorthPeak.value - observed.value) < 0.005 && storedNetWorthPeak.date === observed.date) return
    // Solo escribir si cambia; replace permite corregir a la baja el 12k erróneo.
    let cancelled = false
    import("@/lib/net-worth-snapshots").then(({ replaceNetWorthPeak, persistNetWorthPeakIfHigher }) => {
      const payload = { value: observed.value, date: observed.date, label: observed.label }
      const op = storedNetWorthPeak && storedNetWorthPeak.value > observed.value + 0.005
        ? replaceNetWorthPeak(payload)
        : persistNetWorthPeakIfHigher(payload)
      return op.then((peak) => {
        if (cancelled) return
        setStoredNetWorthPeak(peak)
        try { localStorage.setItem("netWorthPeak", JSON.stringify(peak)) } catch {}
      })
    }).catch((error) => console.error("[Finance] No se pudo recalcular el pico histórico:", error))
    return () => { cancelled = true }
  }, [loading, netWorthHasData, state.accounts, state.transactions, today, storedNetWorthPeak])

  // Si el máximo persistido cae dentro del tramo que acabamos de reconstruir,
  // sustituirlo por el máximo real de esa serie. Así se corrigen también los
  // picos obsoletos ya guardados, sin tocar movimientos ni saldos de cuentas.
  useEffect(() => {
    if (loading || !storedNetWorthPeak?.date || !rangeMaxPoint?.date || !netWorthHasData) return

    const keyForDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    let from: Date
    let through: Date
    if (activeRange.unit === "months") {
      from = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - activeRange.count + 1, 1)
      through = monthOffset === 0 ? today : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    } else if (activeRange.unit === "all") {
      from = netWorthTrend[0]?.date ? parseLocalDate(netWorthTrend[0].date) : today
      through = today
    } else {
      through = monthOffset === 0 ? today : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
      from = new Date(through.getFullYear(), through.getMonth(), through.getDate() - (activeRange.unit === "today" ? 0 : activeRange.count - 1))
    }

    const savedDate = /^\d{4}-\d{2}$/.test(storedNetWorthPeak.date)
      ? `${storedNetWorthPeak.date}-01`
      : storedNetWorthPeak.date
    const fromKey = keyForDate(from)
    const throughKey = keyForDate(through)
    if (savedDate < fromKey || savedDate > throughKey) return
    if (storedNetWorthPeak.date === rangeMaxPoint.date && Math.abs(storedNetWorthPeak.value - rangeMaxPoint.patrimonio) < 0.005) return

    let cancelled = false
    import("@/lib/net-worth-snapshots").then(({ reconcileNetWorthPeakAfterBalanceCorrection }) =>
      reconcileNetWorthPeakAfterBalanceCorrection(
        { value: rangeMaxPoint.patrimonio, date: rangeMaxPoint.date, label: rangeMaxPoint.mes.replace(" · pico", "") },
        fromKey
      ).then((peak) => {
        if (!cancelled) setStoredNetWorthPeak(peak)
      })
    ).catch((error) => console.error("[Finance] No se pudo sincronizar el máximo recalculado del patrimonio:", error))
    return () => { cancelled = true }
  }, [loading, storedNetWorthPeak, rangeMaxPoint, netWorthHasData, activeRange, monthOffset, selectedDate, today, netWorthTrend])

  const showRangeMax = !!rangeMaxPoint
  // La variación de arriba compara INICIO DEL RANGO vs hoy: en 30D/6M/12M/24M
  // el inicio del rango suele ser un momento en que el patrimonio era mucho
  // más bajo, así que una bajada real de la última semana queda "enterrada"
  // dentro de la subida del periodo completo y sale en verde. Esta segunda
  // cifra (hoy vs el propio pico) no depende del rango elegido: si hoy estás
  // por debajo del máximo, siempre se ve en rojo, sin importar la pestaña.
  const vsPeakDelta = rangeMaxPoint ? netWorthDisplay - rangeMaxPoint.patrimonio : 0
  const showVsPeakDelta = !!rangeMaxPoint && vsPeakDelta < -0.005
  const vsPeakPct = rangeMaxPoint && Math.abs(rangeMaxPoint.patrimonio) >= 100 ? (vsPeakDelta / Math.abs(rangeMaxPoint.patrimonio)) * 100 : 0

  const balanceAdjustmentsInRange = useMemo(() => {
    if (netWorthTrend.length === 0) return { count: 0, net: 0 }
    const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    const monthly = activeRange.unit === "months"
    const startDate = monthly
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth() - activeRange.count + 1, 1)
      : parseLocalDate(netWorthTrend[0].date)
    const endDate = monthOffset === 0
      ? today
      : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
    const startKey = key(startDate)
    const endKey = key(endDate)
    const currencies = getCurrencyByAccount(state.accounts)
    const accountIds = new Set(state.accounts.map((account) => account.id))
    return state.transactions
      .filter((transaction) => transaction.id.startsWith("adj_") && !isSyntheticOpeningBalanceResidual(transaction) && accountIds.has(transaction.cuenta_id) && transaction.fecha >= startKey && transaction.fecha <= endKey)
      .reduce((summary, transaction) => {
        const signedAmount = transaction.tipo === "ingreso" ? transaction.monto : -transaction.monto
        summary.count += 1
        summary.net += reportingAmount({ ...transaction, monto: signedAmount }, currencies)
        return summary
    }, { count: 0, net: 0 })
  }, [netWorthTrend, activeRange.unit, activeRange.count, monthOffset, selectedDate, today, state.accounts, state.transactions])

  const spending = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  const spendTotal = spending.reduce((s, c) => s + c.monto, 0)
  const topSpending = spending.slice(0, 6)
  const maxSpend = topSpending[0]?.monto ?? 1
  const unusualSpend = useMemo(() => {
    const historyByCategory = new Map<string, { total: number; months: number }>()
    for (let offset = 1; offset <= 3; offset++) {
      const date = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - offset, 1)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      for (const item of getCategoryBreakdown(analysisTransactions, month, currencyByAccount)) {
        const prior = historyByCategory.get(item.categoria) ?? { total: 0, months: 0 }
        historyByCategory.set(item.categoria, { total: prior.total + item.monto, months: prior.months + 1 })
      }
    }
    return spending.slice(0, 6)
      .map((item) => {
        const history = historyByCategory.get(item.categoria)
        if (!history || history.months < 2) return null
        const average = history.total / history.months
        return item.monto >= 150 && item.monto >= average * 1.5 && item.monto - average >= 100
          ? { category: item.categoria, current: item.monto, average }
          : null
      })
      .find((item) => item !== null) ?? null
  }, [selectedDate, analysisTransactions, currencyByAccount, spending])
  const needsVsWants = useMemo(() => getNeedsVsWantsForMonth(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  const needsVsWantsTotal = needsVsWants.necesidades + needsVsWants.deseos
  const needsPct = needsVsWantsTotal > 0 ? Math.round((needsVsWants.necesidades / needsVsWantsTotal) * 100) : 0
  const catColor = (name: string) => state.categories.find((c) => c.name === name)?.color ?? "var(--accent-blue)"

  // Composición del patrimonio por tipo de cuenta usando los saldos guardados.
  const composicion = useMemo(() => {
    const groups: Record<string, number> = {}
    for (const a of displayAccounts) {
      if (a.tipo === "inversion") continue
      groups[a.tipo] = (groups[a.tipo] ?? 0) + convertToEur(a.saldo, a.currency)
    }
    if (investmentDisplayTotal > 0) groups.inversion = investmentDisplayTotal
    const total = Object.values(groups).reduce((s, v) => s + Math.max(v, 0), 0) || 1
    return Object.entries(groups)
      .filter(([, v]) => v > 0)
      .map(([tipo, v]) => ({
        tipo,
        label: typeConfig[tipo as Account["tipo"]]?.label ?? tipo,
        value: v,
        pct: (v / total) * 100,
        color: typeConfig[tipo as Account["tipo"]]?.color ?? "var(--muted-foreground)",
      }))
      .sort((a, b) => b.value - a.value)
  }, [displayAccounts, investmentDisplayTotal])

  // La misma composición, pero cuenta a cuenta y con el color de cada una
  // (las inversiones se agrupan porque su valor sale de las posiciones). Si
  // dos colores se confunden, el gráfico usa otro tono de la paleta.
  const composicionCuentas = useMemo(() => {
    const items = displayAccounts
      .filter((a) => a.tipo !== "inversion")
      .map((a) => ({ account: a, value: convertToEur(a.saldo, a.currency) }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value)
    const invColor = typeConfig.inversion.color
    const colors = distinctAccountColors(items.map((x) => x.account), investmentDisplayTotal > 0 ? [invColor] : [])
    const total = items.reduce((s, x) => s + x.value, 0) + Math.max(investmentDisplayTotal, 0) || 1
    const rows: { key: string; label: string; value: number; pct: number; color: string; accountId: string | null; tipo: Account["tipo"] }[] = items.map((x) => ({
      key: x.account.id,
      label: x.account.nombre,
      value: x.value,
      pct: (x.value / total) * 100,
      color: colors.get(x.account.id) ?? accountColor(x.account),
      accountId: x.account.id,
      tipo: x.account.tipo,
    }))
    if (investmentDisplayTotal > 0) rows.push({ key: "inversion", label: "Inversiones", value: investmentDisplayTotal, pct: (investmentDisplayTotal / total) * 100, color: invColor, accountId: null, tipo: "inversion" })
    // Bienes apuntados en /patrimonio (vivienda, coche…): mismo reparto de %.
    if (assetDebt.bienes > 0) {
      const all = total + assetDebt.bienes
      for (const r of rows) r.pct = (r.value / all) * 100
      rows.push({ key: "bienes", label: "Bienes", value: assetDebt.bienes, pct: (assetDebt.bienes / all) * 100, color: "var(--gold)", accountId: null, tipo: "efectivo" })
    }
    return rows.sort((a, b) => b.value - a.value)
  }, [displayAccounts, investmentDisplayTotal, assetDebt.bienes])
  const composicionLeyenda = useMemo(() => {
    const MAX = 5
    if (composicionCuentas.length <= MAX + 1) return composicionCuentas
    const rest = composicionCuentas.slice(MAX)
    const value = rest.reduce((s, r) => s + r.value, 0)
    return [...composicionCuentas.slice(0, MAX), { key: "otras", label: `Otras ${rest.length}`, value, pct: rest.reduce((s, r) => s + r.pct, 0), color: "var(--muted-foreground)", accountId: null, tipo: "efectivo" as Account["tipo"] }]
  }, [composicionCuentas])
  const openCompositionItem = (item: { key: string; accountId: string | null; tipo: Account["tipo"] }) => {
    if (item.accountId) router.push(`/cuentas/${item.accountId}`)
    else if (item.key === "otras") router.push("/cuentas")
    else if (item.key === "bienes") router.push("/patrimonio")
    else setCompositionTipo(item.tipo)
  }

  // Racha de meses consecutivos con flujo de caja positivo, contando hacia
  // atrás desde el mes anterior al seleccionado (el mes en curso se excluye
  // porque suele estar incompleto y falsearía la racha).
  // `streakBreak` es el mes en negativo que cortó la racha (null si la corta
  // un mes sin datos), para poder enlazar a sus movimientos.
  const { count: streak, breakMonth: streakBreak } = useMemo(() => {
    let count = 0
    let breakMonth: { key: string; label: string } | null = null
    for (let offset = 1; offset <= 24; offset++) {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const t = getMonthTotalsByString(analysisTransactions, key, currencyByAccount)
      if (t.ingresos === 0 && t.gastos === 0) break
      if (t.neto <= 0) { breakMonth = { key, label: d.toLocaleDateString("es-ES", { month: "long" }) }; break }
      count++
    }
    return { count, breakMonth }
  }, [selectedDate, analysisTransactions, currencyByAccount])

  const bestMonth = useMemo(() => {
    let best = { idx: -1, neto: 0 }
    monthlyYear.forEach((m, i) => { if (m.neto > best.neto) best = { idx: i, neto: m.neto } })
    if (best.idx < 0) return null
    return { label: new Date(year, best.idx, 1).toLocaleDateString("es-ES", { month: "long" }), key: `${year}-${String(best.idx + 1).padStart(2, "0")}`, value: best.neto }
  }, [monthlyYear, year])

  const nextGoal = useMemo(() => {
    return state.sinkingFunds
      .map((f) => ({ nombre: f.nombre, pct: f.cantidad_objetivo > 0 ? (fundCurrentAmount(f, state.accounts) / f.cantidad_objetivo) * 100 : 0, objetivo: f.cantidad_objetivo }))
      .filter((f) => f.pct < 100)
      .sort((a, b) => b.pct - a.pct)[0] ?? null
  }, [state.sinkingFunds, state.accounts])

  const emergency = useMemo(
    () => getEmergencyCushionStatus(displayAccounts, state.sinkingFunds),
    [displayAccounts, state.sinkingFunds]
  )
  const emergencyBalanceEur = emergency
    ? convertToEur(emergency.current, displayAccounts.find((item) => item.id === emergency.accountId)?.currency ?? "EUR")
    : displayAccounts
      .filter((account) => account.tipo === "emergencia")
      .reduce((total, account) => total + convertToEur(account.saldo, account.currency), 0)

  const { goals: wealthGoals, loaded: wealthGoalsLoaded } = useWealthGoals()
  const goalsView = useMemo(() => goalProgress(wealthGoals, netWorthDisplay), [wealthGoals, netWorthDisplay])
  const nextWealthGoal = goalsView.next
  const recentTransactions = useMemo(
    () => analysisTransactions.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 4),
    [analysisTransactions]
  )
  const accountName = (id: string) => state.accounts.find((a) => a.id === id)?.nombre ?? "—"

  // Patrimonio de hace un mes, para el factor "Patrimonio en crecimiento" de
  // la puntuación financiera. A propósito NO se usa `rangeStart` (el primer
  // punto del gráfico de evolución): ese valor depende de qué pestaña de
  // rango tenga seleccionada el usuario (Hoy/7D/30D/6M/12M/24M), así que la
  // puntuación cambiaba solo con tocar el gráfico, sin que nada financiero
  // hubiera cambiado. Este punto de comparación es fijo.
  const scoreBaselineDate = useMemo(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1), [selectedDate])
  const scoreBaselineKey = `${scoreBaselineDate.getFullYear()}-${String(scoreBaselineDate.getMonth() + 1).padStart(2, "0")}`
  const scoreBaseline = useMemo(
    () => getNetWorthAtMonth(state.accounts, state.transactions, scoreBaselineKey),
    [state.accounts, state.transactions, scoreBaselineKey]
  )

  // ── Hero «Tu dinero» y «Lo importante hoy» ──
  const isCurrentMonth = dashboardPeriod === "month" && monthOffset === 0
  const { hidden: paceHidden, dismiss: dismissPace, ready: paceReady } = useDismissForMonth(PACE_BANNER_SETTING)
  const monthForecast = useMemo(() => monthEndForecast(analysisTransactions.filter((t) => countsTowardCashFlow(t, analysisTransactions)), recurringPayments, today), [analysisTransactions, recurringPayments, today])
  const isSingleMonth = periodBounds.start.getFullYear() === periodBounds.end.getFullYear() && periodBounds.start.getMonth() === periodBounds.end.getMonth()
  // Gasto del mes anterior hasta el mismo día (o el mes anterior completo si
  // se mira un mes ya cerrado), para la frase «vas bien / ojo».
  const comparableExpenses = useMemo(() => {
    if (!isSingleMonth) return null
    const s0 = periodBounds.start, e0 = periodBounds.end
    const start = new Date(s0.getFullYear(), s0.getMonth() - 1, 1)
    const lastDay = new Date(e0.getFullYear(), e0.getMonth(), 0).getDate()
    const end = new Date(e0.getFullYear(), e0.getMonth() - 1, Math.min(e0.getDate(), lastDay))
    const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    let total = 0, any = false
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || t.fecha < k(start) || t.fecha > k(end) || !countsTowardCashFlow(t, analysisTransactions)) continue
      total += reportingAmount(t, currencyByAccount); any = true
    }
    return any ? total : null
  }, [isSingleMonth, periodBounds.start, periodBounds.end, analysisTransactions, currencyByAccount])
  const daysLeftInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - today.getDate() + 1
  const accountsWithBalance = displayAccounts.filter((a) => Math.abs(a.saldo) > 0.005).length
  const expenseChangePct = comparableExpenses && comparableExpenses > 0 ? Math.round((periodTotals.gastos / comparableExpenses - 1) * 100) : null

  const { score, tier: scoreTier, factors: scoreFactors } = useMemo(
    () => getFinancialScore({
      savingsRate,
      monthlyNeto: monthTotals.neto,
      netWorthCurrent: netWorth, // la base del mes anterior solo tiene cuentas
      netWorthBaseline: scoreBaseline,
      hasActiveEmergencyFund: displayAccounts.some((a) => a.tipo === "emergencia" && a.saldo > 0),
    }),
    [savingsRate, monthTotals.neto, netWorth, scoreBaseline, displayAccounts]
  )

  // Dónde se arregla cada factor de la puntuación que no se cumple.
  const hasEmergencyAccount = displayAccounts.some((account) => account.tipo === "emergencia")
  const scoreFixes: Record<string, { href: string; hint: string }> = {
    "Tasa de ahorro ≥ 20%": { href: `/transactions?tipo=gasto&mes=${selectedMonth}`, hint: "Revisa los gastos del mes" },
    "Flujo del mes positivo": { href: `/transactions?mes=${selectedMonth}`, hint: "Mira los movimientos del mes" },
    "Patrimonio en crecimiento": { href: "/cuentas", hint: "Revisa los saldos de tus cuentas" },
    "Fondo de emergencia activo": { href: hasEmergencyAccount ? "/cuentas?tipo=emergencia" : "/cuentas", hint: hasEmergencyAccount ? "Recarga tu cuenta de emergencia" : "Crea una cuenta de emergencia" },
  }
  const scoreDisplayLabel = scoreTier.label
  const scoreColor = scoreTier.label === "Excelente" ? "var(--gold)" : scoreTier.color

  const sortedAccounts = useMemo(() => displayAccounts.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)), [displayAccounts])

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  // Presupuesto del mes seleccionado, mismo cálculo que MonthlyBudget, para
  // incluirlo también en el PDF exportado.
  const budgetRows = useMemo(() => {
    // Un pase agrupa el gasto por categoría en vez de refiltrar
    // `analysisTransactions` entera por cada presupuesto (ver mismo fix en
    // MonthlyBudget) — evita un O(presupuestos × transacciones) en cada render.
    const categoryById = new Map(state.categories.map((c) => [c.id, c]))
    const spentByCategory = new Map<string, number>()
    for (const t of analysisTransactions) {
      if (t.tipo !== "gasto" || !t.fecha.startsWith(selectedMonth) || !countsTowardCashFlow(t, analysisTransactions)) continue
      spentByCategory.set(t.categoria, (spentByCategory.get(t.categoria) ?? 0) + reportingAmount(t, currencyByAccount))
    }

    return state.budgets
      .filter((b) => b.month === selectedMonth)
      .map((budget) => {
        const category = categoryById.get(budget.category_id)
        const gastado = spentByCategory.get(category?.name ?? "") ?? 0
        return { categoria: category?.name ?? "Sin categoría", gastado, limite: budget.amount }
      })
      .filter((b) => b.limite > 0)
  }, [state.budgets, state.categories, analysisTransactions, selectedMonth, currencyByAccount])
  const insights = useMemo<Insight[]>(() => {
    const out: Insight[] = []
    const nextFixed = recurringPayments.filter((p) => p.tipo === "gasto" && p.overdueDays <= 0).sort((a, b) => b.overdueDays - a.overdueDays)[0]
    const tight = budgetRows.filter((b) => b.limite > 0 && b.gastado / b.limite >= 0.8).sort((a, b) => b.gastado / b.limite - a.gastado / a.limite)[0]
    const kinds = importantTodayKinds({ upcomingFixed: Boolean(nextFixed), unusualOrBudget: Boolean(unusualSpend || tight) })
    if (kinds.includes("fijo") && nextFixed) {
      const days = Math.abs(nextFixed.overdueDays)
      const date = parseLocalDate(nextFixed.nextDate).toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })
      out.push({ key: "fijo", kind: "fijo", eyebrow: "Próximo gasto fijo", title: <>{nextFixed.descripcion || nextFixed.categoria} · <Sensitive>{formatMoney(nextFixed.monto, currencyByAccount.get(nextFixed.cuenta_id) ?? "EUR")}</Sensitive></>, detail: `Toca ${days === 0 ? "hoy" : `el ${date}`}. Revisa que haya saldo en ${accountName(nextFixed.cuenta_id)}.`, href: "/agenda", cta: "Ver gastos fijos", meta: days === 0 ? "hoy" : `en ${days} ${days === 1 ? "día" : "días"}` })
    }
    if (kinds.includes("dispara")) {
      if (unusualSpend) {
        out.push({ key: "dispara", kind: "dispara", eyebrow: "Se está disparando", title: <>{unusualSpend.category}: <Sensitive>{formatMoney(unusualSpend.current, "EUR")}</Sensitive></>, detail: <>Tu media reciente es <Sensitive>{formatMoney(unusualSpend.average, "EUR")}</Sensitive>. Aviso orientativo: supera la media al menos un 50 % y 100 €.</>, href: `/transactions?tipo=gasto&categoria=${encodeURIComponent(unusualSpend.category)}&mes=${selectedMonth}`, cta: "Ver movimientos", meta: `+${Math.round((unusualSpend.current / unusualSpend.average - 1) * 100)} %` })
      } else if (tight) {
        out.push({ key: "dispara", kind: "dispara", eyebrow: "Presupuesto a revisar", title: <>{tight.categoria}: <Sensitive>{formatMoney(tight.gastado, "EUR")}</Sensitive> de <Sensitive>{formatMoney(tight.limite, "EUR")}</Sensitive></>, detail: tight.gastado > tight.limite ? "Ya has pasado el límite de este mes." : "Estás cerca del límite de este mes.", href: `/transactions?tipo=gasto&categoria=${encodeURIComponent(tight.categoria)}&mes=${selectedMonth}`, cta: "Revisar", meta: `${Math.round((tight.gastado / tight.limite) * 100)} %` })
      }
    }
    return out
  }, [recurringPayments, budgetRows, unusualSpend, selectedMonth, currencyByAccount])

  const [exportingPdf, setExportingPdf] = useState(false)
  const handleExportDashboard = async () => {
    setExportingPdf(true)
    try {
      const { generateDashboardPdf } = await import("@/lib/dashboard-pdf")
      const { getSetting } = await import("@/lib/settings")
      const netWorthTarget = Number(localStorage.getItem("networth-target")) || Number(await getSetting("networth-target").catch(() => null)) || 0
      // El informe refleja el saldo manual; no se inventan coste ni beneficio
      // a partir de posiciones o cotizaciones externas.
      const investmentInvested = investmentDisplayTotal
      generateDashboardPdf({
        month: formatMonth(selectedDate),
        netWorth: netWorthDisplay,
        netWorthTarget,
        netWorthTrend: (activeRange.unit === "months"
          ? netWorthTrend.filter((point) => /^\d{4}-\d{2}$/.test(point.date)).slice(-activeRange.count)
          : netWorthTrend
        ).map((d) => ({ label: d.mes, value: Math.round(d.patrimonio) })),
        rangeLabel: activeRange.id,
        score,
        scoreLabel: scoreTier.label,
        scoreFactors,
        ingresos: monthTotals.ingresos,
        gastos: monthTotals.gastos,
        savingsRate,
        annualIngresos,
        annualGastos,
        annualNeto,
        year,
        investmentValue: investmentDisplayTotal,
        investmentInvested,
        investmentPnl: investmentDisplayTotal - investmentInvested,
        accountComposition: composicion.map(({ label, value }) => ({ name: label, value })),
        accounts: sortedAccounts.map((a) => ({ nombre: a.nombre, tipo: typeConfig[a.tipo]?.label ?? a.tipo, banco: a.banco, saldo: convertToEur(a.saldo, a.currency) })),
        goals: state.sinkingFunds.map((fund) => {
          const account = displayAccounts.find((item) => item.id === fund.cuenta_id)
          const currency = account?.currency ?? "EUR"
          return { nombre: fund.nombre, actual: convertToEur(fundCurrentAmount(fund, displayAccounts), currency), objetivo: convertToEur(fund.cantidad_objetivo, currency), fecha: fund.fecha_limite }
        }),
        budgets: budgetRows,
        spending: topSpending.map((c) => ({ categoria: c.categoria, monto: c.monto })),
        transactions: filterTransactionsByMonth(analysisTransactions, selectedMonth).filter((t) => countsTowardCashFlow(t, analysisTransactions)).map((t) => ({
          fecha: t.fecha,
          descripcion: t.descripcion,
          categoria: t.categoria,
          tipo: t.tipo,
          monto: convertToEur(t.monto, currencyByAccount.get(t.cuenta_id) ?? "EUR"),
        })),
      })
    } finally {
      setExportingPdf(false)
    }
  }

  const metricTitles: Record<DashboardMetric, string> = {
    gastos: "Gastos del periodo", ingresos: "Ingresos del periodo", neto: "Ahorro neto",
    inversion: "Saldo en inversión", cash: "Dinero disponible", patrimonio: "Patrimonio total",
  }
  const metricAmount = metricDetail === "gastos" ? periodTotals.gastos
    : metricDetail === "ingresos" ? periodTotals.ingresos
      : metricDetail === "neto" ? periodTotals.neto
        : metricDetail === "inversion" ? investmentDisplayTotal
          : metricDetail === "cash" ? spendableTotal
            : netWorthDisplay
  const metricTransactions = metricDetail === "gastos" ? expenseTransactions : metricDetail === "ingresos" ? incomeTransactions : []
  const sortedDetailAccounts = [...(metricDetail === "inversion" ? investmentAccounts : metricDetail === "cash" ? spendableAccounts : displayAccounts)]
    .sort((a, b) => convertToEur(b.saldo, b.currency) - convertToEur(a.saldo, a.currency))

  return (
    <div className="content-fade w-full max-w-full space-y-6 overflow-x-clip sm:space-y-7">
      <header className="relative z-40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="page-section-label hidden sm:block">Resumen general</p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Resumen</h1>
          </div>
          <button
            type="button"
            onClick={togglePrivacy}
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 lg:hidden"
            aria-label={privacy ? "Mostrar cifras" : "Ocultar cifras"}
            title={privacy ? "Mostrar cifras" : "Ocultar cifras"}
          >
            {privacy ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 self-start sm:w-auto sm:self-auto">
          <PeriodPopover
            open={showPeriodPicker}
            onOpenChange={setShowPeriodPicker}
            title="Periodo del dashboard"
            className="flex w-full min-w-0 items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-auto sm:flex-none"
            trigger={<>
              <button onClick={() => { setMonthOffset((p) => p + 1); setDashboardPeriod("month") }} aria-label="Mes anterior" className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" data-period-trigger onClick={() => setShowPeriodPicker((open) => !open)} aria-expanded={showPeriodPicker} aria-haspopup="dialog" aria-label={`Periodo: ${periodBounds.label}. Cambiar`} className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-1 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:w-52 sm:flex-none">
                <CalendarClock className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{periodBounds.label}</span>
              </button>
              <button onClick={() => { setMonthOffset((p) => Math.max(0, p - 1)); setDashboardPeriod("month") }} aria-label="Mes siguiente" disabled={monthOffset === 0} className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 active:scale-90"><ChevronRight className="h-4 w-4" /></button>
            </>}
          >
            <div className="space-y-0.5">
              <PeriodOption selected={dashboardPeriod === "month" && monthOffset === 0} onSelect={() => chooseDashboardPeriod("month")}>Este mes</PeriodOption>
              <PeriodOption selected={dashboardPeriod === "previous" || (dashboardPeriod === "month" && monthOffset === 1)} onSelect={() => chooseDashboardPeriod("previous")}>Mes anterior</PeriodOption>
              <PeriodOption selected={dashboardPeriod === "3m"} onSelect={() => chooseDashboardPeriod("3m")}>Últimos 3 meses</PeriodOption>
              <PeriodOption selected={dashboardPeriod === "6m"} onSelect={() => chooseDashboardPeriod("6m")}>Últimos 6 meses</PeriodOption>
              <PeriodOption selected={dashboardPeriod === "year"} onSelect={() => chooseDashboardPeriod("year")} hint={today.getFullYear()}>Este año</PeriodOption>
              {previousYears.map((year) => (
                <PeriodOption key={year} selected={dashboardPeriod === "previousYear" && selectedDate.getFullYear() === year} onSelect={() => chooseYear(year)}>{year}</PeriodOption>
              ))}
            </div>
            <PeriodDivider />
            <PeriodOption selected={dashboardPeriod === "custom"} onSelect={() => { setDashboardPeriod("custom"); setCustomEndpoint("start"); setCustomYear(Number(customStartMonth.slice(0, 4))) }}>Personalizado</PeriodOption>
            {dashboardPeriod === "custom" && (
              <div className="mt-2 space-y-2 px-1 pb-1">
                <div className="grid grid-cols-2 gap-2">
                  {([ ["start", "Desde", customStartMonth], ["end", "Hasta", customEndMonth] ] as const).map(([endpoint, label, month]) => {
                    const [year, monthNumber] = month.split("-").map(Number)
                    const monthName = new Date(year, monthNumber - 1, 1).toLocaleDateString("es-ES", { month: "long" })
                    const monthLabel = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`
                    return <button key={endpoint} type="button" onClick={() => { setCustomEndpoint(endpoint); setCustomYear(year) }} aria-pressed={customEndpoint === endpoint} className={cn("min-h-12 rounded-xl border px-3 py-1.5 text-left transition-colors", customEndpoint === endpoint ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/50 text-foreground hover:bg-muted")}><span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span><span className="block truncate text-sm font-semibold">{monthLabel}</span></button>
                  })}
                </div>
                <MonthGrid
                  year={customYear}
                  onYearChange={setCustomYear}
                  selected={customEndpoint === "start" ? customStartMonth : customEndMonth}
                  onSelect={(month) => { chooseCustomMonth(customEndpoint, month); if (customEndpoint === "start") setCustomEndpoint("end") }}
                  max={`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`}
                />
                <button type="button" onClick={() => setShowPeriodPicker(false)} className="min-h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90">Aplicar</button>
              </div>
            )}
          </PeriodPopover>
          {monthOffset > 0 && <Button type="button" variant="ghost" className="min-h-11 shrink-0 rounded-full px-3 text-xs font-semibold" onClick={() => chooseDashboardPeriod("month")}>Este mes</Button>}
          <Button onClick={() => openMovementDialog()} className="hidden gap-2 rounded-full px-4 shadow-sm sm:inline-flex">
            <Plus className="h-4 w-4" /> Nuevo movimiento
          </Button>
          {hasAnyData && (
            <Button onClick={handleExportDashboard} disabled={exportingPdf} variant="outline" className="w-full min-w-0 gap-1.5 whitespace-nowrap rounded-full px-3 text-xs sm:w-auto sm:flex-none sm:px-4 sm:text-sm" title="Incluye resumen, gráficos, cuentas, metas, presupuestos y movimientos del mes seleccionado.">
              <FileDown className="h-4 w-4" /> {exportingPdf ? "Generando…" : "Informe mensual PDF"}
            </Button>
          )}
        </div>
      </header>

      <OnboardingGuide />

      {!loading && overduePayments.length > 0 && (
        <button
          onClick={() => router.push("/agenda")}
          className="flex w-full items-center gap-3 rounded-[14px] border border-amber-500/20 bg-amber-500/[0.06] p-4 text-left transition-colors hover:bg-amber-500/[0.1]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500"><AlertTriangle className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              {overduePayments.length === 1
                ? overduePayments[0].tipo === "ingreso" ? "Tienes un ingreso recurrente pendiente" : "Tienes 1 pago recurrente atrasado"
                : `Tienes ${overduePayments.length} movimientos recurrentes atrasados`}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{overduePayments.map((p) => p.descripcion || p.categoria).join(" · ")}</span>
          </span>
        </button>
      )}

      {!loading && dueSoonPayments.length > 0 && (
        <button
          type="button"
          onClick={() => router.push("/agenda")}
          className="flex w-full items-center gap-3 rounded-[14px] border border-primary/20 bg-primary/[0.05] p-4 text-left transition-colors hover:bg-primary/[0.09]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarClock className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Movimientos recurrentes próximos</span>
            <span className="block truncate text-xs text-muted-foreground">
              {dueSoonPayments.map((payment) => `${payment.descripcion || payment.categoria} · ${payment.overdueDays === 0 ? "hoy" : `en ${Math.abs(payment.overdueDays)} días`}`).join("  ·  ")}
            </span>
          </span>
          <span className="hidden shrink-0 text-xs font-medium text-primary sm:block">Ver movimientos</span>
        </button>
      )}

      {loading ? (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3"><Skeleton className="h-72 lg:col-span-2" /><Skeleton className="h-72" /></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
        </div>
      ) : !hasAnyData ? (
        <div className="flex flex-col items-center justify-center pt-20 text-center">
          <h2 className="text-2xl font-bold text-foreground">Tu panel financiero</h2>
          <p className="mt-2 text-muted-foreground">Comienza configurando tu primera cuenta.</p>
          <Button onClick={() => setShowNewAccount(true)} className="mt-6 rounded-full px-6">Crear cuenta</Button>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-5">
          <TopTiles
            netWorth={netWorthDisplay}
            netWorthDelta={netWorth - scoreBaseline + assetDebt.neto - assetDebtPrevMonth}
            sparkline={netWorthTrend.map((p) => p.patrimonio)}
            label={periodBounds.label}
            income={periodTotals.ingresos}
            expenses={periodTotals.gastos}
            net={periodTotals.neto}
            expenseChange={expenseChangePct}
            invested={investmentDisplayTotal}
            gain={investmentView.gainPct === null ? null : investmentView.gain}
            gainPct={investmentView.gainPct}
          />
          {isCurrentMonth && paceReady && !paceHidden && (
            <section aria-label="Previsión de fin de mes" className="flex min-w-0 items-center gap-3 rounded-[18px] border border-border bg-card px-4 py-3 sm:px-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Binoculars className="size-[18px]" /></span>
              <div className="min-w-0 flex-1">
                {monthForecast === null ? (
                  <p className="text-sm font-semibold text-foreground">Aún pocos datos este mes</p>
                ) : (
                  <p className="text-sm font-semibold text-foreground">A este ritmo acabarás {today.toLocaleDateString("es-ES", { month: "long" })} con <Sensitive className={monthForecast >= 0 ? "text-emerald-500" : "text-red-500"}>{monthForecast >= 0 ? "+" : "−"}{formatMoney(Math.abs(monthForecast), "EUR")}</Sensitive></p>
                )}
                <p className="text-xs text-muted-foreground">Según tu ritmo de gasto y los gastos fijos que quedan este mes</p>
              </div>
              <button
                type="button"
                onClick={dismissPace}
                aria-label="Cerrar previsión de fin de mes"
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-4" />
              </button>
            </section>
          )}
          <MonthlySummaryCard netWorthNow={netWorthDisplay} />
          <ImportantToday items={insights} />

          <section className={`${CARD} min-w-0`} aria-label="Ingresos y gastos del periodo">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ingresos vs gastos</h2>
                <p className="mt-1 text-xs text-muted-foreground">{cashflowGranularity === "week" ? `${periodBounds.label} · por semana` : <>Últimos meses<span className="sm:hidden"> · toca una barra para ver su resumen</span><span className="hidden sm:inline"> · haz clic en una barra para ver el desglose</span></>}</p>
              </div>
              <div className="range-tabs" aria-label="Agrupar gráfica">
                {([ ["week", "Semana"], ["month", "Mes"] ] as const).map(([granularity, label]) => (
                  <button key={granularity} type="button" onClick={() => setCashflowGranularity(granularity)} data-active={cashflowGranularity === granularity} aria-pressed={cashflowGranularity === granularity} className="range-tab">{label}</button>
                ))}
              </div>
              {cashflowGranularity === "month" && (
                <div className="range-tabs" aria-label="Meses de la gráfica">
                  {([[3, "3M"], [6, "6M"], [12, "12M"], [24, "24M"], [0, "Todo"]] as const).map(([m, label]) => (
                    <button key={label} type="button" onClick={() => setCashflowMonths(m)} data-active={cashflowMonths === m} aria-pressed={cashflowMonths === m} className="range-tab">{label}</button>
                  ))}
                </div>
              )}
            </div>
            {periodCashflow.some((bucket) => bucket.Ingresos > 0 || bucket.Gastos > 0) ? periodCashflow.length <= 12 ? (
              <>
                <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--accent-green)]" />Ingresos</span>
                  <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-[var(--accent-red)]" />Gastos</span>
                  {cashflowGranularity === "month" && <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-[var(--gold)]" />Ahorro neto</span>}
                </div>
                <CashflowComboChart data={periodCashflow} activeKey={cashflowGranularity === "month" ? selectedMonth : null} showSavings={cashflowGranularity === "month"} onSelect={(key) => setCashflowDrillKey(key)} />
              </>
            ) : (
              <BarChart data={periodCashflow} index="label" categories={cashflowGranularity === "month" ? ["Ingresos", "Gastos", "Ahorro neto"] : ["Ingresos", "Gastos"]} colors={cashflowGranularity === "month" ? ["emerald", "red", "orange"] : ["emerald", "red"]} valueFormatter={chartAxisFormatter} yAxisWidth={moneyAxisWidth(periodCashflow.flatMap((bucket) => [bucket.Ingresos, bucket.Gastos, ...(cashflowGranularity === "month" ? [bucket["Ahorro neto"]] : [])]))} barCategoryGap={periodCashflow.length <= 3 ? "32%" : periodCashflow.length <= 6 ? "22%" : periodCashflow.length <= 14 ? "14%" : "8%"} tickGap={periodCashflow.length > 8 ? 18 : 6} showLegend showGridLines customTooltip={(props) => <CashflowHoverTooltip {...props} granularity={cashflowGranularity} />} key={cashflowChartKey} onValueChange={(value) => { const key = value && typeof value.key === "string" ? value.key : null; if (key) setCashflowDrillKey(key) }} className="dashboard-cashflow-chart h-56 cursor-pointer sm:h-72" showAnimation={cashflowChartKey === 0} />
            ) : <EmptyPlaceholder text="No hay ingresos ni gastos en este periodo" className="h-56 sm:h-72" />}
            {periodCashflow.some((bucket) => bucket.Ingresos > 0 || bucket.Gastos > 0) && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground"><span className="sm:hidden">Toca una barra para ver su resumen; «Ver desglose» abre el detalle.</span><span className="hidden sm:inline">Pasa el ratón para ver el resumen; haz clic en una barra para el desglose por semana y categoría.</span></p>
                {periodCashflow.length > 12 && (
                  <button type="button" onClick={() => setCashflowDrillKey(periodCashflow[periodCashflow.length - 1].key)} className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:min-h-9">
                    Desglose de {periodCashflow[periodCashflow.length - 1].label} <ChevronRight className="size-3.5" />
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Fila hero: evolución de patrimonio + puntuación financiera */}
          <section className="stagger-fade grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-5 2xl:grid-cols-12" style={{ animationDelay: "0ms" }}>
            {/* Patrimonio + rango */}
            <div className={`${CARD_HERO} min-w-0 flex flex-col md:col-span-2 xl:col-span-2 2xl:col-span-6`}>
              <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="w-full min-w-0 flex-1 sm:w-auto">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="page-section-label">Evolución del patrimonio</p>
                    {isAllTimeHigh && <span className="gold-badge shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Máximo histórico</span>}
                    {netWorthHasData && (
                      <button type="button" onClick={() => setNetWorthExpanded(true)} aria-label="Ampliar el gráfico de patrimonio" className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-foreground/[0.03] text-foreground transition-colors hover:border-primary/40 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:hidden">
                        <Maximize2 className="size-4" weight="bold" />
                      </button>
                    )}
                  </div>
                  <p className="hero-figure mt-2 text-[clamp(1.8rem,7vw,2.5rem)] font-bold tracking-tight tabular-nums">
                    <AnimatedNumber value={netWorthDisplay} />
                  </p>
                  {hasUsableRangeBaseline && (
                    <p className={cn("mt-1 inline-flex flex-wrap items-center gap-x-1.5 text-sm font-medium", rangeDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {rangeDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <Sensitive>{rangeDelta >= 0 ? "+" : "−"}{formatMoney(Math.abs(rangeDelta), "EUR")}</Sensitive>
                      <span className="text-muted-foreground">{showPct ? `· ${formatCappedPct(rangePct)} ` : ""}vs. inicio del periodo</span>
                    </p>
                  )}
                  {showRangeMax && rangeMaxPoint && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Pico observado: <span title="Mayor saldo reconstruido observado dentro del periodo"><Sensitive as="span" className="font-semibold text-foreground">{formatMoney(rangeMaxPoint.patrimonio, "EUR")}</Sensitive></span> ({rangeMaxPoint.mes.replace(" · pico", "")})
                      {showVsPeakDelta && (
                        <Sensitive as="span" className={cn("ml-1 font-semibold", vsPeakPct < -1 ? "text-red-500" : "text-muted-foreground")}>
                          · {formatMoney(vsPeakDelta, "EUR")}{Math.abs(vsPeakPct) > 0.05 ? ` (${formatCappedPct(vsPeakPct)})` : ""} desde el pico
                        </Sensitive>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex w-full items-center gap-2 sm:w-auto">
                  <div className="range-tabs w-full justify-between sm:w-auto sm:justify-start">
                    {RANGES.map((r) => (
                      <button key={r.id} onClick={() => setRangeId(r.id)} data-active={rangeId === r.id} className="range-tab tabular-nums">
                        {r.id}
                      </button>
                    ))}
                  </div>
                  {netWorthHasData && (
                    <button type="button" onClick={() => setNetWorthExpanded(true)} aria-label="Ampliar el gráfico de patrimonio" className="hidden size-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-foreground/[0.03] text-foreground transition-colors hover:border-primary/40 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex">
                      <Maximize2 className="size-4" weight="bold" />
                    </button>
                  )}
                </div>
              </div>
              <NetWorthExpanded
                open={netWorthExpanded}
                onOpenChange={setNetWorthExpanded}
                points={netWorthSeries.points}
                monthly={netWorthSeries.monthly}
                bars={netWorthBars}
                ranges={RANGES}
                rangeId={rangeId}
                onRange={setRangeId}
                netWorth={netWorthDisplay}
                peak={rangeMaxPoint ? { value: rangeMaxPoint.patrimonio, label: rangeMaxPoint.mes === "hoy" ? "hoy" : rangeMaxPoint.mes.replace(" · pico", "") } : null}
                privacy={privacy}
                formatValue={chartFormatter}
                formatAxis={chartAxisFormatter}
              />
              {activeRange.unit === "today" && netWorthTrend.length <= 1 ? (
                <EmptyPlaceholder text="Sin movimientos registrados hoy todavía" className="mt-4 h-52 sm:h-64" />
              ) : netWorthHasData ? (
                <div className="mt-4 flex flex-1 flex-col">
                  <NetWorthChart
                    points={netWorthSeries.points}
                    monthly={netWorthSeries.monthly}
                    formatValue={chartFormatter}
                    formatAxis={chartAxisFormatter}
                    hideValues={privacy}
                    onActivate={() => setNetWorthExpanded(true)}
                    activateLabel="Pulsa para ver el gráfico ampliado."
                    className="h-40 min-h-40 w-full sm:h-52 2xl:h-60"
                  />
                  <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                    <Maximize2 className="size-3" weight="bold" />
                    <span className="sm:hidden">Toca el gráfico para ampliarlo</span><span className="hidden sm:inline">Haz clic en el gráfico para ampliarlo</span>
                  </p>
                  <p className="mx-auto mt-4 max-w-[62ch] border-t border-border/60 pt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                    El histórico se reconstruye desde los saldos actuales y los movimientos guardados; no equivale a una captura bancaria de cada fecha.
                  </p>
                  {balanceAdjustmentsInRange.count > 0 && (
                    <p className="mx-auto mt-2 max-w-[62ch] text-center text-[11px] leading-relaxed text-muted-foreground" role="note">
                      {balanceAdjustmentsInRange.count} {balanceAdjustmentsInRange.count === 1 ? "ajuste de saldo" : "ajustes de saldo"} incluidos en la curva
                      {Math.abs(balanceAdjustmentsInRange.net) > 0.005 && <> · impacto neto <Sensitive className={balanceAdjustmentsInRange.net >= 0 ? "text-emerald-500" : "text-red-500"}>{balanceAdjustmentsInRange.net > 0 ? "+" : "−"}{formatMoney(Math.abs(balanceAdjustmentsInRange.net), "EUR")}</Sensitive></>}. No cuentan como ingresos ni gastos.
                    </p>
                  )}
                  {openingHistoryIsEstimated && (
                    <p className="mx-auto mt-2 max-w-[62ch] text-center text-[11px] leading-relaxed text-amber-500/90" role="note">
                      Hay saldos de apertura sin historial completo; las variaciones desde fechas anteriores pueden ser estimadas.
                    </p>
                  )}
                </div>
              ) : (
                <EmptyPlaceholder text="Sin datos de patrimonio todavía" className="mt-4 h-52 sm:h-64" />
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-2 2xl:col-span-6">
            {/* Puntuación financiera */}
            <div className={`${CARD_HERO} flex min-w-0 flex-col`}>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Puntuación financiera</p>
                <InfoPopover label="Cómo se calcula la puntuación financiera" title="¿Cómo se calcula?" className="-my-1.5 ml-auto">
                  <p>Una nota de 0 a 100 con cuatro partes, según el mes que estás viendo:</p>
                  <ul className="space-y-1.5">
                    <li><strong className="text-foreground">Ahorro · hasta 40 puntos.</strong> Lo que ahorras de lo que ingresas: 0&nbsp;% da 0 puntos y un 30&nbsp;% o más da los 40.</li>
                    <li><strong className="text-foreground">Balance del mes · hasta 20.</strong> Ingresos menos gastos: con −100&nbsp;€ o menos, 0 puntos; con +100&nbsp;€ o más, los 20.</li>
                    <li><strong className="text-foreground">Patrimonio · hasta 20.</strong> Cuánto ha cambiado desde el final del mes anterior: −2&nbsp;% o peor, 0 puntos; +2&nbsp;% o mejor, los 20.</li>
                    <li><strong className="text-foreground">Fondo de emergencia · 20.</strong> Si tienes una cuenta de emergencia con saldo.</li>
                  </ul>
                  <p>80 o más: Excelente · 60–79: Sólido · 40–59: Mejorable · menos de 40: Frágil.</p>
                </InfoPopover>
              </div>
              <div className="mt-3 flex items-center gap-4 xl:flex-col xl:items-center xl:text-center 2xl:flex-row 2xl:text-left">
                <div className="relative flex shrink-0 items-center justify-center">
                  <CircularProgress value={score} size={92} strokeWidth={8} color={scoreColor} />
                  <span className="absolute text-2xl font-bold tabular-nums text-foreground">{score}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: scoreColor }}>{scoreDisplayLabel}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{scoreFactors.filter((f) => f.ok).length} de {scoreFactors.length} puntos clave cumplidos</p>
                  <InfoPopover label="Ver los factores de la puntuación" title="Tus factores" trigger={<span className="mt-1.5 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary">Ver factores<ChevronRight className="size-3.5" /></span>}>
              <div className="space-y-1">
                {scoreFactors.map((f) => {
                  const fix = scoreFixes[f.label]
                  const icon = (
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", f.ok ? "bg-emerald-500/15 text-emerald-500" : "bg-primary/15 text-primary")}>
                      {f.ok ? <Check className="h-2.5 w-2.5" strokeWidth={2.2} /> : <Minus className="h-2.5 w-2.5" />}
                    </span>
                  )
                  if (f.ok || !fix) {
                    return <div key={f.label} className="flex min-h-9 items-center gap-2 px-2 text-xs">{icon}<span className={f.ok ? "text-foreground" : "text-muted-foreground"}>{f.label}</span></div>
                  }
                  return (
                    <Link key={f.label} href={fix.href} className="-mx-0 flex min-h-11 items-center gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      {icon}
                      <span className="min-w-0 flex-1">
                        <span className="block text-muted-foreground">{f.label}</span>
                        <span className="block text-[11px] font-medium text-primary">{fix.hint}</span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  )
                })}
              </div>
                  </InfoPopover>
                </div>
              </div>
            </div>
            <div className={`${CARD} flex min-w-0 flex-col p-4 sm:p-4`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Layers3 className="h-4 w-4 text-primary" /> Composición del patrimonio</p>
              {composicionCuentas.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Sin datos todavía.</p>
              ) : (
                <>
                  <div className="mt-5 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full">
                    {composicionCuentas.map((c) => (
                      <button key={c.key} type="button" tabIndex={-1} aria-hidden="true" onClick={() => openCompositionItem(c)} className="h-full min-w-[3px] transition-opacity hover:opacity-75" style={{ width: `${c.pct}%`, backgroundColor: c.color }} title={`${c.label}: ${Math.round(c.pct)}%`} />
                    ))}
                  </div>
                  <div className="-mx-2 mt-2 grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:gap-x-1 sm:gap-y-0">
                    {composicionLeyenda.map((c) => (
                      <button key={c.key} type="button" onClick={() => openCompositionItem(c)} aria-label={`${c.label}, ${Math.round(c.pct)}%: ver ${c.accountId ? "cuenta" : "cuentas"}`} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg px-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-9">
                        <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15" style={{ backgroundColor: c.color }} />
                        <span className="line-clamp-2 min-w-0 break-words leading-tight text-foreground sm:line-clamp-1 sm:max-w-[9rem]">{c.label}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(c.pct)}%</span>
                        <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground sm:ml-0" />
                      </button>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-4 space-y-0.5 border-t border-border pt-3">
                {([
                  {
                    key: "racha",
                    icon: <Flame className="h-3.5 w-3.5 text-amber-500" />,
                    label: "Racha de ahorro",
                    hint: streak === 0 && streakBreak ? `${streakBreak.label} cerró en negativo · revisar` : null,
                    value: <span className="text-foreground">{streak > 0 ? `${streak} ${streak === 1 ? "mes" : "meses"}` : "—"}</span>,
                    href: streak === 0 && streakBreak ? `/transactions?mes=${streakBreak.key}` : null,
                  },
                  {
                    key: "mejor",
                    icon: <Trophy className="h-3.5 w-3.5 text-emerald-500" />,
                    label: "Mejor mes",
                    hint: bestMonth ? bestMonth.label : null,
                    value: <span className="text-emerald-500">{bestMonth ? <Sensitive>{formatMoney(bestMonth.value, "EUR")}</Sensitive> : "—"}</span>,
                    href: bestMonth ? `/transactions?mes=${bestMonth.key}` : null,
                  },
                  {
                    key: "objetivo",
                    icon: <Target className="h-3.5 w-3.5 text-primary" />,
                    label: "Próximo objetivo",
                    hint: nextGoal ? nextGoal.nombre : "Crea una meta de ahorro",
                    value: <span className="text-foreground">{nextGoal ? <Sensitive>{formatMoney(nextGoal.objetivo, "EUR")}</Sensitive> : "—"}</span>,
                    href: "/cuentas#metas",
                  },
                ]).map((row) => {
                  const body = (
                    <>
                      <span className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                        {row.icon}
                        <span className="min-w-0">
                          <span className="block">{row.label}</span>
                          {row.hint && <span className={cn("block truncate text-[11px] first-letter:uppercase", row.key === "racha" ? "font-medium text-primary" : "text-muted-foreground/80")}>{row.hint}</span>}
                        </span>
                      </span>
                      <span className="max-w-[45%] truncate text-sm font-semibold tabular-nums">{row.value}</span>
                      {row.href && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
                    </>
                  )
                  return row.href ? (
                    <Link key={row.key} href={row.href} className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{body}</Link>
                  ) : (
                    <div key={row.key} className="flex min-h-11 items-center gap-2">{body}</div>
                  )
                })}
              </div>
            </div>

            <div className={`${CARD} @container min-w-0 p-4 sm:p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Tu camino financiero</p>
                  </div>
                </div>
                {wealthGoalsLoaded && wealthGoals.length > 0 && (
                  <button type="button" onClick={openGoalsEditor} className="shrink-0 whitespace-nowrap rounded-full border border-border/70 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Editar objetivos
                  </button>
                )}
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                {/* En columnas estrechas (escritorio 4 columnas) el importe baja
                    debajo del título en vez de cortar «Avanza en Vi…». */}
                <div className="flex flex-col gap-1 @[20rem]:flex-row @[20rem]:items-start @[20rem]:justify-between @[20rem]:gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Próximo objetivo</p>
                    <p className="mt-1 text-sm font-semibold text-foreground @[20rem]:truncate">{nextWealthGoal ? (nextWealthGoal.name || "Tu siguiente objetivo") : goalsView.allDone ? "Objetivos conseguidos" : "Ponte un objetivo"}</p>
                  </div>
                  {nextWealthGoal && <p className="shrink-0 text-sm font-bold tabular-nums text-foreground @[20rem]:text-right"><Sensitive>{money(nextWealthGoal.amount)}</Sensitive></p>}
                </div>
                {nextWealthGoal && (
                  <>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/80">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${goalsView.progress}%` }} />
                    </div>
                    <p className="mt-1.5 text-right text-[10px] tabular-nums text-muted-foreground"><Sensitive>{formatMoney(goalsView.remaining, "EUR")}</Sensitive> restantes</p>
                  </>
                )}
                {goalsView.allDone && <p className="mt-2 text-[11px] font-medium text-emerald-500">Todos tus objetivos conseguidos. Ponte uno nuevo cuando quieras.</p>}
              </div>

              {wealthGoalsLoaded && wealthGoals.length === 0 ? (
                <div className="mt-3"><GoalsEmpty netWorth={netWorthDisplay} compact /></div>
              ) : goalsView.upcoming.length > 0 && (
                <div className={cn("mt-3 grid gap-2", goalsView.upcoming.length === 1 ? "grid-cols-1" : goalsView.upcoming.length === 2 ? "grid-cols-2" : "grid-cols-3")} aria-label="Próximos objetivos de patrimonio">
                  {goalsView.upcoming.map((goal, index) => (
                    <div key={goal.id} className={cn("min-w-0 rounded-xl border px-1.5 py-2.5 sm:px-2", index === 0 ? "border-primary/30 bg-primary/[0.07]" : "border-border/70 bg-background/35")}>
                      <p className="line-clamp-2 break-words text-[9px] uppercase leading-tight tracking-wide text-muted-foreground">{goalLabel(goal, index)}</p>
                      <p className={cn("mt-1 truncate text-[11px] font-semibold tabular-nums sm:text-xs", index === 0 ? "text-primary" : "text-foreground")}><Sensitive>{money(goal.amount)}</Sensitive></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </section>

          <section
            className={cn("grid grid-cols-1 gap-4 lg:gap-5", topSpending.length > 0 && "lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.85fr)]")}
            aria-label="Gastos y colchón de emergencia"
          >
            {topSpending.length > 0 && (
              <div className={`${CARD} stagger-fade min-w-0`} style={{ animationDelay: "200ms" }}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Distribución de gastos</p>
                <div className="flex items-center gap-3">
                  <p className="text-sm tabular-nums text-muted-foreground"><Sensitive>{formatMoney(spendTotal, "EUR")}</Sensitive></p>
                  <button type="button" onClick={() => router.push("/analytics")} className="text-xs font-medium text-primary transition-colors hover:opacity-70">Ver en Analíticas</button>
                </div>
              </div>
              {unusualSpend && (
                <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-3">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{unusualSpend.category} supera tu referencia reciente.</span>{" "}
                <Sensitive>{formatMoney(unusualSpend.current, "EUR")}</Sensitive> frente a una media de <Sensitive>{formatMoney(unusualSpend.average, "EUR")}</Sensitive> en hasta 3 meses con actividad. Aviso orientativo: supera la media al menos un 50 % y 100 €.
                  </p>
                  <button type="button" onClick={() => router.push(`/transactions?tipo=gasto&categoria=${encodeURIComponent(unusualSpend.category)}&mes=${selectedMonth}`)} className="text-xs font-semibold text-amber-600 hover:underline dark:text-amber-400">Revisar</button>
                </div>
              )}
              {needsVsWantsTotal > 0 && (
                <div className="mb-4 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>Necesidades <span className="text-foreground">{needsPct}%</span></span>
                    <span>Deseos <span className="text-foreground">{100 - needsPct}%</span></span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-[var(--accent-green)] transition-all duration-700" style={{ width: `${needsPct}%` }} />
                    <div className="h-full bg-[var(--accent-amber)] transition-all duration-700" style={{ width: `${100 - needsPct}%` }} />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setShowSpendBreakdown((v) => !v)}
                className="mb-3 text-xs font-medium text-primary transition-colors hover:opacity-70"
                aria-expanded={showSpendBreakdown}
              >
                {showSpendBreakdown ? "Ocultar desglose" : "Ver desglose por categoría"}
              </button>
              {showSpendBreakdown && (
                <div className="grid grid-cols-1 gap-x-8 gap-y-3.5 sm:grid-cols-2">
                  {topSpending.map((c) => (
                    <button key={c.categoria} type="button" aria-label={`Ver gastos de ${c.categoria}`} onClick={() => router.push(`/transactions?tipo=gasto&categoria=${encodeURIComponent(c.categoria)}&mes=${selectedMonth}`)} className="group space-y-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-md">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                          <CategoryIcon name={c.categoria} color={catColor(c.categoria)} />
                          <span className="truncate">{c.categoria}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          <Sensitive>{formatMoney(c.monto, "EUR")}</Sensitive> · {Math.round((c.monto / spendTotal) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `max(${(c.monto / maxSpend) * 100}%, 10px)`, backgroundColor: catColor(c.categoria) }} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
              </div>
            )}
            {/* Sin gastos este mes, el colchón ocupa todo el ancho (nunca flota solo en medio). */}
            <div className="w-full min-w-0">
              <EmergencyRunwayCard balanceEur={emergencyBalanceEur} />
            </div>
          </section>

          {/* Resumen, movimientos y metas comparten la última fila del panel. */}
          <section className="stagger-fade grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 xl:grid-cols-4" style={{ animationDelay: "240ms" }}>
            <div className={cn(CARD, "flex flex-col gap-4", showAnnual && "md:col-span-2 xl:col-span-4")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnnual((v) => !v)}
                  className="flex items-center gap-2 text-sm font-semibold text-foreground transition-colors hover:opacity-80"
                  aria-expanded={showAnnual}
                >
                  <PiggyBank className="h-4 w-4 text-primary" />
                  Acumulado {year}
                  <span className="text-xs font-medium text-muted-foreground">{showAnnual ? "Ocultar" : "Ver más"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/analytics")}
                  className="text-xs font-medium text-primary transition-colors hover:opacity-70"
                >
                  Ver en Analíticas
                </button>
              </div>
              {!showAnnual && (
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <p className="min-w-0 text-sm text-muted-foreground">
                    Neto anual:{" "}
                    <Sensitive as="span" className={cn("font-semibold tabular-nums", annualNeto >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {formatMoney(annualNeto, "EUR")}
                    </Sensitive>
                  </p>
                  <div className="min-h-16 flex-1" role="img" aria-label={`Tendencia mensual del ahorro neto de ${year}`}>
                    <MiniBars values={monthlyYear.map((month) => month.neto)} color={annualNeto >= 0 ? "var(--accent-green)" : "var(--accent-red)"} signed className="h-full min-h-16 w-full" />
                  </div>
                  <dl className="grid gap-1.5 border-t border-border/70 pt-3 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Ingresos del año</dt><dd><Sensitive className="font-semibold tabular-nums text-emerald-500">{formatMoney(annualIngresos, "EUR")}</Sensitive></dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Gastos del año</dt><dd><Sensitive className="font-semibold tabular-nums text-red-500">{formatMoney(annualGastos, "EUR")}</Sensitive></dd></div>
                    {bestSavingsMonth && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Mejor mes de ahorro</dt><dd className="text-right"><span className="capitalize">{bestSavingsMonth.label}</span> · <Sensitive className="font-semibold tabular-nums text-emerald-500">{formatMoney(bestSavingsMonth.neto, "EUR")}</Sensitive></dd></div>}
                  </dl>
                </div>
              )}
              {showAnnual && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <AnnualStat label="Ingresos totales" year={year} value={annualIngresos} accent="var(--accent-green)" icon={HandCoins}>
                    <MiniBars values={monthlyYear.map((m) => m.ingresos)} color="var(--accent-green)" />
                  </AnnualStat>
                  <AnnualStat label="Gastos totales" year={year} value={annualGastos} accent="var(--accent-red)" icon={Receipt}>
                    <MiniBars values={monthlyYear.map((m) => m.gastos)} color="var(--accent-red)" />
                  </AnnualStat>
                  <AnnualStat label="Ahorro neto anual" year={year} value={annualNeto} accent={annualNeto >= 0 ? "var(--accent-green)" : "var(--accent-red)"} icon={PiggyBank}>
                    <MiniBars values={monthlyYear.map((m) => m.neto)} color={annualNeto >= 0 ? "var(--accent-green)" : "var(--accent-red)"} signed />
                  </AnnualStat>
                </div>
              )}
            </div>
            <div className={cn(CARD, "min-w-0", showAnnual && "md:col-span-2 xl:col-span-2")}>
              <div className="mb-4 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Últimos movimientos</p>
                <button onClick={() => router.push("/transactions")} className="text-xs font-medium text-primary transition-colors hover:opacity-70">Ver todos</button>
              </div>
              {recentTransactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>
              ) : (
                <div className="divide-y divide-border/70">
                  {recentTransactions.map((t) => (
                    <div key={t.id} className={cn("flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0", recentTransactions.indexOf(t) >= 3 && "hidden xl:flex")}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80">
                          <CategoryIcon name={t.categoria} color={catColor(t.categoria)} />
                        </span>
                        <div className="min-w-0">
                          <p title={t.descripcion || t.categoria} className="line-clamp-2 break-words text-sm font-medium text-foreground">{t.descripcion || t.categoria}</p>
                          <p title={accountName(t.cuenta_id)} className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">{accountName(t.cuenta_id)}</p>
                        </div>
                      </div>
                      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", (t.tipo === "ingreso" ? t.monto : -t.monto) >= 0 ? "text-emerald-500" : "text-red-500")}>
                        <Sensitive>{(t.tipo === "ingreso" ? t.monto : -t.monto) >= 0 ? "+" : "−"}{formatMoney(Math.abs(t.monto), state.accounts.find((a) => a.id === t.cuenta_id)?.currency ?? "EUR")}</Sensitive>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0 md:col-span-2 xl:col-span-2 [&_[data-slot=card]]:h-full">
              <SinkingFundsGrid />
            </div>
          </section>
        </div>
      )}

      <Dialog open={metricDetail !== null} onOpenChange={(open) => { if (!open) setMetricDetail(null) }}>
        <DialogContent className={cn("sm:max-w-xl", SHEET_CONTENT)}>
          {metricDetail && (
            <>
              <SheetHandle />
              <DialogHeader>
                <DialogTitle className="pr-8 text-lg">{metricTitles[metricDetail]}</DialogTitle>
                <DialogDescription>
                  {metricDetail === "gastos" || metricDetail === "ingresos" || metricDetail === "neto"
                    ? periodBounds.label
                    : `Saldos a ${formatMonth(selectedDate)}`}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <p className={cn("text-3xl font-bold tracking-tight tabular-nums", metricDetail === "gastos" ? "text-red-500" : metricDetail === "ingresos" || (metricDetail === "neto" && metricAmount >= 0) ? "text-emerald-500" : "text-foreground")}>
                  <Sensitive>{formatMoney(metricAmount, "EUR")}</Sensitive>
                </p>

                {(metricDetail === "gastos" || metricDetail === "ingresos") && (
                  <>
                    <p className="text-sm text-muted-foreground">{metricTransactions.length} {metricDetail === "gastos" ? "gastos" : "ingresos"} en este periodo · los traspasos emparejados no se cuentan.</p>
                    {metricTransactions.length > 0 ? (
                      <div className="max-h-[42svh] divide-y divide-border overflow-y-auto overscroll-contain rounded-xl border border-border/70 px-3">
                        {metricTransactions.map((transaction) => {
                          const account = state.accounts.find((item) => item.id === transaction.cuenta_id)
                          const value = reportingAmount(transaction, currencyByAccount)
                          return (
                            <div key={transaction.id} className="flex min-w-0 items-center justify-between gap-3 py-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{transaction.descripcion || transaction.categoria}</p>
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{parseLocalDate(transaction.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · {transaction.categoria} · {account?.nombre ?? "Cuenta eliminada"}</p>
                              </div>
                              <Sensitive className={`shrink-0 text-sm font-semibold tabular-nums ${metricDetail === "ingresos" ? "text-emerald-500" : "text-foreground"}`}>
                                {metricDetail === "ingresos" ? "+" : "−"}{formatMoney(value, "EUR")}
                              </Sensitive>
                            </div>
                          )
                        })}
                      </div>
                    ) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Todavía no hay movimientos de este tipo en {periodBounds.label}.</p>}
                    {periodMonths.length === 1 ? (
                      <Link href={`/transactions?tipo=${metricDetail === "gastos" ? "gasto" : "ingreso"}&mes=${periodMonths[0].key}`} onClick={() => setMetricDetail(null)} className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted">
                        Ver todos los movimientos <ChevronRight className="size-4" />
                      </Link>
                    ) : periodMonths.length > 1 && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-muted-foreground">Ver todos los movimientos de:</p>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {periodMonths.map((month) => (
                            <Link key={month.key} href={`/transactions?tipo=${metricDetail === "gastos" ? "gasto" : "ingreso"}&mes=${month.key}`} onClick={() => setMetricDetail(null)} className="flex min-h-11 items-center justify-center rounded-xl border border-border text-sm font-medium capitalize text-foreground transition-colors hover:border-primary/40 hover:bg-muted">
                              {month.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {metricDetail === "neto" && (
                  <div className="space-y-3 rounded-xl border border-border/70 p-4">
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Ingresos</span><Sensitive className="font-medium tabular-nums text-emerald-500">{formatMoney(periodTotals.ingresos, "EUR")}</Sensitive></div>
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Gastos</span><Sensitive className="font-medium tabular-nums text-red-500">−{formatMoney(periodTotals.gastos, "EUR")}</Sensitive></div>
                    <div className="flex justify-between gap-3 border-t border-border pt-3 text-sm"><span className="font-semibold">Tasa de ahorro</span><span className="font-semibold tabular-nums">{periodSavingsRate}%</span></div>
                    <p className="text-xs leading-5 text-muted-foreground">Ahorro neto = ingresos del periodo − gastos del periodo. Los traspasos entre tus cuentas no alteran este cálculo.</p>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button type="button" onClick={() => setMetricDetail("ingresos")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted"><HandCoins className="app-icon-tint size-4 text-emerald-500" /> Ver ingresos</button>
                      <button type="button" onClick={() => setMetricDetail("gastos")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-muted"><Receipt className="app-icon-tint size-4 text-red-500" /> Ver gastos</button>
                    </div>
                  </div>
                )}

                {metricDetail === "cash" && (
                  <>
                    <p className="text-sm text-muted-foreground">Solo efectivo y cuentas de gasto con saldo. Ahorro, emergencia e inversión quedan excluidos.</p>
                    <div className="divide-y divide-border rounded-xl border border-border/70 px-3">
                      {sortedDetailAccounts.length > 0 ? sortedDetailAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{account.nombre}</p><p className="text-xs text-muted-foreground">{account.banco || typeConfig[account.tipo]?.label}</p></div>
                          <Sensitive className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(account.saldo, account.currency)}</Sensitive>
                        </div>
                      )) : <p className="py-5 text-center text-sm text-muted-foreground">No tienes cuentas de efectivo o gastos.</p>}
                    </div>
                  </>
                )}

                {(metricDetail === "inversion" || metricDetail === "patrimonio") && (
                  <>
                    <p className="text-sm text-muted-foreground">{metricDetail === "inversion" ? "Saldos manuales de tus cuentas de inversión." : "Incluye todas tus cuentas: efectivo, gastos, ahorro, emergencia e inversión."}</p>
                    <div className="max-h-[42svh] divide-y divide-border overflow-y-auto overscroll-contain rounded-xl border border-border/70 px-3">
                      {sortedDetailAccounts.length > 0 ? sortedDetailAccounts.map((account) => (
                        <div key={account.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0"><p className="truncate text-sm font-medium">{account.nombre}</p><p className="text-xs text-muted-foreground">{typeConfig[account.tipo]?.label ?? account.tipo}{account.banco ? ` · ${account.banco}` : ""}</p></div>
                          <Sensitive className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(account.saldo, account.currency)}</Sensitive>
                        </div>
                      )) : <p className="py-5 text-center text-sm text-muted-foreground">{metricDetail === "inversion" ? "No tienes cuentas de inversión." : "No hay cuentas registradas."}</p>}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={compositionTipo !== null} onOpenChange={(open) => { if (!open) setCompositionTipo(null) }}>
        <DialogContent className={cn("sm:max-w-md", SHEET_CONTENT)}>
          {compositionTipo && (() => {
            const group = composicion.find((c) => c.tipo === compositionTipo)
            const accounts = displayAccounts.filter((account) => account.tipo === compositionTipo).sort((a, b) => convertToEur(b.saldo, b.currency) - convertToEur(a.saldo, a.currency))
            const config = typeConfig[compositionTipo]
            const TypeIcon = config?.icon
            return (
              <>
                <SheetHandle />
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 pr-8 text-lg">
                    {TypeIcon && <span className="flex size-8 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in oklab, ${config.color} 16%, transparent)`, color: config.color }}><TypeIcon className="size-4" /></span>}
                    {config?.label ?? compositionTipo}
                  </DialogTitle>
                  <DialogDescription>{group ? `${Math.round(group.pct)}% de tu patrimonio` : "Sin saldo"} · saldos a {formatMonth(selectedDate)}</DialogDescription>
                </DialogHeader>
                <p className="text-3xl font-bold tracking-tight tabular-nums"><Sensitive>{formatMoney(group?.value ?? 0, "EUR")}</Sensitive></p>
                <ul className="max-h-[42svh] divide-y divide-border/70 overflow-y-auto overscroll-contain rounded-xl border border-border/70">
                  {accounts.map((account) => (
                    <li key={account.id}>
                      <Link href={`/cuentas/${account.id}`} onClick={() => setCompositionTipo(null)} className="flex min-h-12 items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none">
                        <AccountDot account={account} className="size-2.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{account.nombre}</span>
                          {account.banco && <span className="block truncate text-xs text-muted-foreground">{account.banco}</span>}
                        </span>
                        <Sensitive className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(account.saldo, account.currency)}</Sensitive>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link href={`/cuentas?tipo=${compositionTipo}`} onClick={() => setCompositionTipo(null)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted">
                  Ver en Cuentas <ChevronRight className="size-4" />
                </Link>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <CashflowDrilldown bucket={cashflowDrillBucket} granularity={cashflowGranularity} transactions={cashflowGranularity === "month" ? chartTransactions : periodTransactions} currencyByAccount={currencyByAccount} catColor={catColor} onClose={closeCashflowDrill} />

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
    </div>
  )
}

// Inicio depende de la fecha y la hora de este dispositivo (mes actual, «hoy»,
// copia local del pico de patrimonio) y de datos que solo existen en el
// navegador. El servidor (en UTC) y el móvil (en hora de Madrid) no siempre
// están en el mismo día o mes (p. ej. de 00:00 a 01:00), y eso provocaba el
// error de hidratación de React (#418). Se pinta el esqueleto en el servidor
// y en el primer render del navegador, y el contenido real justo después.
const noopSubscribe = () => () => {}
export default function DashboardContent() {
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  return hydrated ? <DashboardInner /> : <DashboardLoading />
}
