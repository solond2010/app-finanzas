"use client"

import React, { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { BarChart } from "@tremor/react"
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Check, ChevronLeft, ChevronRight, Eye, EyeOff, FileDown, Flame, Gauge, Layers3, Minus, PiggyBank, Plus, Receipt, Target, TrendingDown, TrendingUp } from "lucide-react"
import { openMovementDialog } from "@/components/layout/quick-actions"
import { EmergencyRunwayCard } from "@/components/dashboard/emergency-runway-card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { MountainChart } from "@/components/shared/mountain-chart"
import { EmptyPlaceholder } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { TickerTile } from "@/components/shared/ticker-tile"
import { CircularProgress } from "@/components/ui/circular-progress"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { filterTransactionsByMonth, fundCurrentAmount, getAccountsAtMonth, getCategoryBreakdown, getEmergencyCushionStatus, getFinancialScore, getMonthTotalsByString, getNeedsVsWantsForMonth, getNetWorthAtMonth, getSavingsRate, getUpcomingRecurring, getCurrencyByAccount, reportingAmount, buildPreciseNetWorthHistory, buildPreciseNetWorthHistoryMonthly, countsTowardCashFlow } from "@/lib/calculations"
import { convertToEur, formatMoney } from "@/lib/currency"
import { useFinance, type Account } from "@/lib/store"
import { usePrivacy } from "@/lib/privacy"
import { typeConfig } from "@/lib/account-types"
import { formatMonth, isInitialBalanceTransaction, chartFormatter, formatCappedPct, PCT_CHANGE_CAP } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { milestoneStepFor, upcomingMilestones } from "@/lib/wealth-milestones"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import type { StoredNetWorthPeak } from "@/lib/net-worth-snapshots"
import { parseLocalDate } from "@/lib/date-utils"

const CARD = "rounded-[14px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_-10px_rgba(0,0,0,0.08)] sm:p-6"
// Mismo card que arriba pero con el tinte azul-marino de hero-panel, reservado
// para las dos cifras más importantes de la página (patrimonio y puntuación).
const CARD_HERO = "rounded-[14px] hero-panel p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_-10px_rgba(0,0,0,0.08)] sm:p-6"
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
type DashboardPeriod = "month" | "previous" | "3m" | "6m" | "year" | "previousYear"
const CashflowTooltip = createChartTooltip(["Ingresos", "Gastos"], ["blue", "red"])

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
            backgroundColor: signed ? (v < 0 ? "var(--accent-red)" : "var(--accent-green)") : color,
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
  const { privacy, toggle: togglePrivacy } = usePrivacy()
  const currencyByAccount = useMemo(() => getCurrencyByAccount(state.accounts), [state.accounts])
  const router = useRouter()
  const { toast } = useToast()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [dashboardPeriod, setDashboardPeriod] = useState<DashboardPeriod>("month")
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [cashflowGranularity, setCashflowGranularity] = useState<"week" | "month">("month")
  const [rangeId, setRangeId] = useState<string>("6M")
  const activeRange = RANGES.find((r) => r.id === rangeId) ?? RANGES[3]
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [showAnnual, setShowAnnual] = useState(false)
  const [showSpendBreakdown, setShowSpendBreakdown] = useState(false)
  const [metricDetail, setMetricDetail] = useState<DashboardMetric | null>(null)
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

  // Conserva la referencia histórica que ya guardó Analíticas. Si una posición
  // se elimina o cambia, la reconstrucción con la cartera actual no debe borrar
  // el máximo que la app ya había observado.
  useEffect(() => {
    let cancelled = false
    import("@/lib/net-worth-snapshots").then(({ loadNetWorthPeak, persistNetWorthPeakIfHigher }) =>
      loadNetWorthPeak().then(async (cloudPeak) => {
        if (cancelled) return
        // Recuperación puntual: el dashboard mostró 5.301,27 € el 5 oct 2026,
        // pero esa observación no llegó a guardarse como pico global.
        const observedPeak = { value: 5301.27, date: "2026-10-05", label: "05 oct" }
        const peak = cloudPeak && cloudPeak.value >= observedPeak.value
          ? cloudPeak
          : await persistNetWorthPeakIfHigher(observedPeak)
        if (cancelled) return
        setStoredNetWorthPeak((previous) => previous && previous.value >= peak.value ? previous : peak)
        try { localStorage.setItem("netWorthPeak", JSON.stringify(peak)) } catch {}
      })
    ).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const selectedDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1), [today, monthOffset])
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const chooseDashboardPeriod = (period: DashboardPeriod) => {
    setDashboardPeriod(period)
    if (period === "month") setMonthOffset(0)
    else if (period === "previous") setMonthOffset(1)
    else if (period === "previousYear") setMonthOffset(12 + today.getMonth() - 11)
    else setMonthOffset(0)
    setShowPeriodPicker(false)
  }

  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0
  const recurringPayments = useMemo(() => getUpcomingRecurring(state.transactions), [state.transactions])
  const overduePayments = useMemo(() => recurringPayments.filter((p) => p.overdueDays > 0), [recurringPayments])
  const dueSoonPayments = useMemo(
    () => recurringPayments.filter((p) => p.overdueDays <= 0 && p.overdueDays >= -7).sort((a, b) => b.overdueDays - a.overdueDays).slice(0, 3),
    [recurringPayments]
  )

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth, currencyByAccount), [analysisTransactions, selectedMonth, currencyByAccount])
  const periodBounds = useMemo(() => {
    let start: Date
    let end: Date
    if (dashboardPeriod === "previousYear") {
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
  }, [dashboardPeriod, selectedDate, monthOffset, today])
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
  const periodCashflow = useMemo(() => {
    const buckets: { key: string; label: string; Ingresos: number; Gastos: number }[] = []
    if (cashflowGranularity === "month") {
      const cursor = new Date(periodBounds.start.getFullYear(), periodBounds.start.getMonth(), 1)
      const last = new Date(periodBounds.end.getFullYear(), periodBounds.end.getMonth(), 1)
      while (cursor <= last) {
        buckets.push({ key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`, label: cursor.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), Ingresos: 0, Gastos: 0 })
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
        buckets.push({ key, label, Ingresos: 0, Gastos: 0 })
        cursor.setDate(cursor.getDate() + 7)
      }
    }
    for (const transaction of periodTransactions) {
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
    return buckets
  }, [cashflowGranularity, periodBounds, periodTransactions, currencyByAccount])
  const periodIncomeTransactions = useMemo(() => periodTransactions.filter((transaction) => transaction.tipo === "ingreso"), [periodTransactions])
  const periodExpenseTransactions = useMemo(() => periodTransactions.filter((transaction) => transaction.tipo === "gasto"), [periodTransactions])
  const periodSavingsRate = getSavingsRate(periodTotals.ingresos, periodTotals.neto)
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const investmentAccounts = useMemo(() => displayAccounts.filter((a) => a.tipo === "inversion"), [displayAccounts])
  const investmentDisplayTotal = useMemo(() => investmentAccounts.reduce((sum, account) => sum + convertToEur(account.saldo, account.currency), 0), [investmentAccounts])
  // Disponible para gasto diario: solo efectivo y cuentas de gasto. Ahorro,
  // emergencia e inversión quedan fuera para no presentar reservas como dinero libre.
  const spendableAccounts = useMemo(() => displayAccounts.filter((account) => account.tipo === "efectivo" || account.tipo === "gastos"), [displayAccounts])
  const spendableTotal = useMemo(() => spendableAccounts.reduce((sum, account) => sum + convertToEur(account.saldo, account.currency), 0), [spendableAccounts])
  const spendableAccountsWithBalance = useMemo(() => spendableAccounts.filter((account) => Math.abs(account.saldo) > 0.005), [spendableAccounts])
  const incomeTransactions = periodIncomeTransactions
  const expenseTransactions = periodExpenseTransactions
  const netWorthDisplay = netWorth

  const savingsRate = getSavingsRate(monthTotals.ingresos, monthTotals.neto)

  const year = selectedDate.getFullYear()
  const monthlyYear = useMemo(
    () => Array.from({ length: 12 }, (_, m) => getMonthTotalsByString(analysisTransactions, `${year}-${String(m + 1).padStart(2, "0")}`, currencyByAccount)),
    [analysisTransactions, year, currencyByAccount]
  )
  const annualIngresos = monthlyYear.reduce((s, m) => s + m.ingresos, 0)
  const annualGastos = monthlyYear.reduce((s, m) => s + m.gastos, 0)
  const annualNeto = annualIngresos - annualGastos

  const netWorthTrend = useMemo(() => {
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
    // Rangos diarios (hoy, 7D, 30D): usar cálculo preciso diario
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
      const monthLabel = monthPoint.mes // ej. "sep 24"
      const [monthStr, yearStr] = monthLabel.split(" ")
      const monthNames = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
      const monthIdx = monthNames.indexOf(monthStr.toLowerCase())
      const year = parseInt("20" + yearStr, 10)
      if (monthIdx === -1) continue
      
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

  // En los rangos por mes (6M/12M/24M) el mes en curso solo aporta UN punto a
  // netWorthTrend: el valor de HOY. Si dentro de ese mismo mes hubo un pico
  // más alto y ya bajó (p.ej. el día 8 vs hoy día 14), ese pico no aparece —
  // "el máximo del periodo" acababa siendo simplemente "el valor de hoy",
  // aunque el pico real (visible en 7D/30D, que sí tienen un punto por día)
  // fuera mayor. Se reconstruye el mes en curso día a día con cálculo preciso
  // solo para hallar el pico real, sin tocar el propio gráfico mensual.
  const currentMonthDailyPeak = useMemo(() => {
    if (monthOffset !== 0) return null
    const daily = buildPreciseNetWorthHistory(
      state.accounts,
      state.transactions,
      today.getDate(),
      today
    )
    return daily.length === 0 ? null : daily.reduce((best, d) => (d.patrimonio > best.patrimonio ? d : best), daily[0])
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

    // Reinsertar en el gráfico el máximo ya guardado si cae dentro del periodo.
    // La serie reconstruida usa posiciones actuales y por sí sola puede perder
    // un pico pasado cuando una posición se elimina o se corrige.
    if (storedNetWorthPeak?.date && points.length > 0) {
      const peakMonth = storedNetWorthPeak.date.slice(0, 7)
      const firstMonth = activeRange.unit === "all"
        ? (points[0].date ?? "").slice(0, 7)
        : activeRange.unit === "months"
          ? `${new Date(selectedDate.getFullYear(), selectedDate.getMonth() - activeRange.count + 1, 1).getFullYear()}-${String(new Date(selectedDate.getFullYear(), selectedDate.getMonth() - activeRange.count + 1, 1).getMonth() + 1).padStart(2, "0")}`
          : (() => {
              const end = monthOffset === 0 ? today : new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0)
              const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (activeRange.unit === "today" ? 1 : activeRange.count - 1))
              return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`
            })()
      const lastMonth = monthOffset === 0 ? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}` : selectedMonth
      const inRange = peakMonth >= firstMonth && peakMonth <= lastMonth
      const sameDay = points.findIndex((point) => point.date === storedNetWorthPeak.date)
      if (inRange && (sameDay < 0 || points[sameDay].patrimonio < storedNetWorthPeak.value)) {
        const date = new Date(`${storedNetWorthPeak.date}T12:00:00`)
        const peakPoint = {
          mes: storedNetWorthPeak.label || date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
          date: storedNetWorthPeak.date,
          patrimonio: storedNetWorthPeak.value,
          breakdown: points[0].breakdown,
        }
        if (sameDay >= 0) points = points.map((point, index) => index === sameDay ? peakPoint : point)
        else points = [...points, peakPoint].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
      }
    }
    return points
  }, [netWorthTrend, activeRange, currentMonthDailyPeak, storedNetWorthPeak, monthOffset, netWorthDisplay, today, selectedDate, selectedMonth])

  const netWorthHasData = !netWorthTrend.every((item) => item.patrimonio === 0)
  const rangeStart = netWorthTrend[0]?.patrimonio ?? 0
  const rangeDelta = netWorthDisplay - rangeStart
  // El % solo se muestra si la base es significativa Y el resultado es un dato
  // legible: contra una base pequeña sale un ">500%" que parece un error, y en
  // ese caso la cifra absoluta ya cuenta la historia completa.
  const rangePct = Math.abs(rangeStart) >= 100 ? (rangeDelta / Math.abs(rangeStart)) * 100 : 0
  const showPct = Math.abs(rangeStart) >= 100 && Math.abs(rangePct) <= PCT_CHANGE_CAP
  // Candidatos al máximo del rango: los puntos del propio gráfico, más (solo
  // para rangos por mes) el pico diario real del mes en curso.
  const maxCandidates = chartTrend.length > 0 ? chartTrend : netWorthTrend
  const allTimeObservedPeak = storedNetWorthPeak?.value ?? (activeRange.unit === "all" && maxCandidates.length > 0 ? Math.max(...maxCandidates.map((point) => point.patrimonio)) : null)
  // Solo afirmar "máximo histórico" cuando se compara contra el pico persistido
  // de toda la vida (o la serie completa si aún no existe referencia guardada).
  const isAllTimeHigh = netWorthHasData && allTimeObservedPeak !== null && netWorthDisplay >= allTimeObservedPeak - 0.005
  // Punto más alto del rango visible y su etiqueta, para poder mostrar no solo
  // cuánto se ha caído desde el máximo sino la cifra total que se llegó a
  // tener (p.ej. "Máximo: 5.636 € el 8 jul"), sin tener que ir a Movimientos.
  // Se muestra en todos los rangos, incluso si hoy es el propio máximo.
  const rangeMaxPoint = netWorthHasData
    ? maxCandidates.reduce((best, t) => (t.patrimonio > best.patrimonio ? t : best), maxCandidates[0])
    : null
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

  // Racha de meses consecutivos con flujo de caja positivo, contando hacia
  // atrás desde el mes anterior al seleccionado (el mes en curso se excluye
  // porque suele estar incompleto y falsearía la racha).
  const streak = useMemo(() => {
    let count = 0
    for (let offset = 1; offset <= 24; offset++) {
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - offset, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const t = getMonthTotalsByString(analysisTransactions, key, currencyByAccount)
      if (t.ingresos === 0 && t.gastos === 0) break
      if (t.neto <= 0) break
      count++
    }
    return count
  }, [selectedDate, analysisTransactions, currencyByAccount])

  const bestMonth = useMemo(() => {
    let best = { idx: -1, neto: 0 }
    monthlyYear.forEach((m, i) => { if (m.neto > best.neto) best = { idx: i, neto: m.neto } })
    if (best.idx < 0) return null
    return { label: new Date(year, best.idx, 1).toLocaleDateString("es-ES", { month: "long" }), value: best.neto }
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

  const wealthMilestones = useMemo(() => upcomingMilestones(netWorthDisplay, 3), [netWorthDisplay])
  const currentMilestoneStep = milestoneStepFor(Math.max(netWorthDisplay, 0))
  const previousMilestone = Math.max(wealthMilestones[0] - currentMilestoneStep, 0)
  const milestoneProgress = currentMilestoneStep > 0
    ? Math.max(0, Math.min(((netWorthDisplay - previousMilestone) / currentMilestoneStep) * 100, 100))
    : 0
  const goalGuidance = emergency && !emergency.isComplete
    ? { title: "Completa tu colchón", detail: `${Math.round(emergency.progress * 100)} % de la meta de emergencia` }
    : monthTotals.neto < 0
      ? { title: "Recupera el balance del mes", detail: "El flujo seleccionado está en negativo" }
      : nextGoal
        ? { title: `Avanza en ${nextGoal.nombre}`, detail: `Meta de ahorro al ${Math.round(nextGoal.pct)} %` }
        : savingsRate >= 20
          ? { title: "Mantén este ritmo", detail: `Tasa de ahorro actual: ${savingsRate} %` }
          : { title: "Construye el siguiente hito", detail: "Un paso cada vez, según tu patrimonio" }

  const recentTransactions = useMemo(
    () => analysisTransactions.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 5),
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

  const { score, tier: scoreTier, factors: scoreFactors } = useMemo(
    () => getFinancialScore({
      savingsRate,
      monthlyNeto: monthTotals.neto,
      netWorthCurrent: netWorthDisplay,
      netWorthBaseline: scoreBaseline,
      hasActiveEmergencyFund: displayAccounts.some((a) => a.tipo === "emergencia" && a.saldo > 0),
    }),
    [savingsRate, monthTotals.neto, netWorthDisplay, scoreBaseline, displayAccounts]
  )

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
        owner: "Mohamed",
        month: formatMonth(selectedDate),
        netWorth: netWorthDisplay,
        netWorthTarget,
        netWorthTrend: netWorthTrend.map((d) => ({ label: d.mes, value: Math.round(d.patrimonio) })),
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
        transactions: filterTransactionsByMonth(analysisTransactions, selectedMonth).map((t) => ({
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
    inversion: "Saldo en inversión", cash: "Cash disponible", patrimonio: "Patrimonio total",
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
    <div className="content-fade w-full max-w-full space-y-6 overflow-x-hidden sm:space-y-7">
      <header className="relative z-40 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="page-section-label hidden sm:block">Resumen general</p>
            <h1 className="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Hola, Mohamed</h1>
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
          <div className="relative flex w-full min-w-0 items-center gap-1 rounded-full border border-border bg-card p-1 sm:w-auto sm:flex-none">
            <button onClick={() => { setMonthOffset((p) => p + 1); setDashboardPeriod("month") }} aria-label="Mes anterior" className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
            <button type="button" onClick={() => setShowPeriodPicker((open) => !open)} aria-expanded={showPeriodPicker} aria-label={`Periodo: ${periodBounds.label}`} className="flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap px-1 text-sm font-medium text-foreground sm:w-52 sm:flex-none">
              <CalendarClock className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{periodBounds.label}</span>
            </button>
            <button onClick={() => { setMonthOffset((p) => Math.max(0, p - 1)); setDashboardPeriod("month") }} aria-label="Mes siguiente" disabled={monthOffset === 0} className="flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 active:scale-90"><ChevronRight className="h-4 w-4" /></button>
            {showPeriodPicker && (
              <div className="absolute right-0 top-full z-[60] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-popover p-3 shadow-xl">
                <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Periodo del dashboard</p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["month", "Mes actual"], ["previous", "Mes anterior"], ["3m", "Últimos 3 meses"], ["6m", "Últimos 6 meses"], ["year", String(today.getFullYear())], ["previousYear", String(today.getFullYear() - 1)],
                  ] as [DashboardPeriod, string][]).map(([period, label]) => (
                    <button key={period} type="button" onClick={() => chooseDashboardPeriod(period)} aria-pressed={dashboardPeriod === period} className={cn("min-h-10 rounded-xl border px-3 text-left text-sm font-medium transition-colors", dashboardPeriod === period ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-background/50 text-foreground hover:bg-muted")}>{label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
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
          <h2 className="text-2xl font-bold text-foreground">Bienvenido, Mohamed</h2>
          <p className="mt-2 text-muted-foreground">Comienza configurando tu primera cuenta.</p>
          <Button onClick={() => setShowNewAccount(true)} className="mt-6 rounded-full px-6">Crear cuenta</Button>
        </div>
      ) : (
        <div className="space-y-5 sm:space-y-5 lg:space-y-5">
          {/* Seis cifras clave: flujo según el periodo elegido y saldos a su mes final. */}
          <section className="stagger-fade grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6" aria-label={`Resumen financiero: ${periodBounds.label}`}>
            <TickerTile label="Gastos" value={<Sensitive>{formatMoney(periodTotals.gastos, "EUR")}</Sensitive>} detail={`${expenseTransactions.length} ${expenseTransactions.length === 1 ? "movimiento" : "movimientos"}`} valueColor="var(--accent-red)" onClick={() => setMetricDetail("gastos")} />
            <TickerTile label="Ingresos" value={<Sensitive>{formatMoney(periodTotals.ingresos, "EUR")}</Sensitive>} detail={`${incomeTransactions.length} ${incomeTransactions.length === 1 ? "movimiento" : "movimientos"}`} valueColor="var(--accent-green)" onClick={() => setMetricDetail("ingresos")} />
            <TickerTile label="Ahorro neto" value={<Sensitive>{formatMoney(periodTotals.neto, "EUR")}</Sensitive>} detail={periodTotals.ingresos > 0 ? `${periodSavingsRate}% de los ingresos` : "Sin ingresos en el periodo"} detailTone={periodTotals.neto >= 0 ? "positive" : "negative"} valueColor={periodTotals.neto >= 0 ? "var(--accent-green)" : "var(--accent-red)"} onClick={() => setMetricDetail("neto")} />
            <TickerTile label="Inversión" value={<Sensitive>{formatMoney(investmentDisplayTotal, "EUR")}</Sensitive>} detail={`${investmentAccounts.length} ${investmentAccounts.length === 1 ? "cuenta" : "cuentas"} · a ${formatMonth(selectedDate)}`} valueColor="var(--accent-violet)" onClick={() => setMetricDetail("inversion")} />
            <TickerTile label="Cash disponible" value={<Sensitive>{formatMoney(spendableTotal, "EUR")}</Sensitive>} detail={`${spendableAccountsWithBalance.length} ${spendableAccountsWithBalance.length === 1 ? "cuenta" : "cuentas"} · a ${formatMonth(selectedDate)}`} valueColor="var(--accent-blue)" onClick={() => setMetricDetail("cash")} />
            <TickerTile label="Patrimonio total" value={<Sensitive>{formatMoney(netWorthDisplay, "EUR")}</Sensitive>} detail={`${displayAccounts.length} cuentas · ${formatMonth(selectedDate)}`} valueColor="var(--foreground)" onClick={() => setMetricDetail("patrimonio")} />
          </section>

          <section className={`${CARD} min-w-0`} aria-label="Ingresos y gastos del periodo">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Ingresos vs gastos</h2>
                <p className="mt-1 text-xs text-muted-foreground">{periodBounds.label} · {cashflowGranularity === "week" ? "agrupado por semana" : "agrupado por mes"}</p>
              </div>
              <div className="range-tabs" aria-label="Agrupar gráfica">
                {([ ["week", "Semana"], ["month", "Mes"] ] as const).map(([granularity, label]) => (
                  <button key={granularity} type="button" onClick={() => setCashflowGranularity(granularity)} data-active={cashflowGranularity === granularity} aria-pressed={cashflowGranularity === granularity} className="range-tab">{label}</button>
                ))}
              </div>
            </div>
            {periodCashflow.some((bucket) => bucket.Ingresos > 0 || bucket.Gastos > 0) ? (
              <BarChart data={periodCashflow} index="label" categories={["Ingresos", "Gastos"]} colors={["blue", "red"]} valueFormatter={chartFormatter} yAxisWidth={64} barCategoryGap={periodCashflow.length <= 1 ? "92%" : periodCashflow.length <= 3 ? "72%" : periodCashflow.length <= 6 ? "55%" : periodCashflow.length <= 14 ? "30%" : "16%"} showLegend showGridLines={false} customTooltip={CashflowTooltip} className="dashboard-cashflow-chart h-56 sm:h-72" showAnimation />
            ) : <EmptyPlaceholder text="No hay ingresos ni gastos en este periodo" className="h-56 sm:h-72" />}
          </section>

          {/* Fila hero: evolución de patrimonio + puntuación financiera */}
          <section className="stagger-fade grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4 xl:gap-5 2xl:grid-cols-12" style={{ animationDelay: "0ms" }}>
            {/* Patrimonio + rango */}
            <div className={`${CARD_HERO} min-w-0 md:col-span-2 xl:col-span-2 2xl:col-span-6`}>
              <div className="flex min-w-0 flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="w-full min-w-0 flex-1 sm:w-auto">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="page-section-label">Evolución del patrimonio</p>
                    {isAllTimeHigh && <span className="gold-badge shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Máximo histórico</span>}
                  </div>
                  <p className="hero-figure mt-2 text-[clamp(1.8rem,7vw,2.5rem)] font-bold tracking-tight tabular-nums">
                    <AnimatedNumber value={netWorthDisplay} />
                  </p>
                  <p className={cn("mt-1 inline-flex flex-wrap items-center gap-x-1.5 text-sm font-medium", rangeDelta >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {rangeDelta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    <Sensitive>{rangeDelta >= 0 ? "+" : "−"}{formatMoney(Math.abs(rangeDelta), "EUR")}</Sensitive>
                    <span className="text-muted-foreground">{showPct ? `· ${formatCappedPct(rangePct)} ` : ""}{activeRange.id === "Hoy" ? "hoy" : `en ${activeRange.id}`}</span>
                  </p>
                  {showRangeMax && rangeMaxPoint && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Máximo del periodo: <Sensitive as="span" className="font-semibold text-foreground">{formatMoney(rangeMaxPoint.patrimonio, "EUR")}</Sensitive> ({rangeMaxPoint.mes.replace(" · pico", "")})
                      {showVsPeakDelta && (
                        <Sensitive as="span" className="ml-1 font-semibold text-red-500">
                          · {formatMoney(vsPeakDelta, "EUR")}{Math.abs(vsPeakPct) > 0.05 ? ` (${formatCappedPct(vsPeakPct)})` : ""} desde el pico
                        </Sensitive>
                      )}
                    </p>
                  )}
                </div>
                <div className="range-tabs w-full justify-between sm:w-auto sm:justify-start">
                  {RANGES.map((r) => (
                    <button key={r.id} onClick={() => setRangeId(r.id)} data-active={rangeId === r.id} className="range-tab tabular-nums">
                      {r.id}
                    </button>
                  ))}
                </div>
              </div>
              {activeRange.unit === "today" && netWorthTrend.length <= 1 ? (
                <EmptyPlaceholder text="Sin movimientos registrados hoy todavía" className="mt-4 h-52 sm:h-64" />
              ) : netWorthHasData ? (
                <div className="mt-4">
                  <MountainChart data={chartTrend} index="mes" category="patrimonio" valueFormatter={chartFormatter} className="h-36 sm:h-52 2xl:h-60" />
                  <p className="mx-auto mt-4 max-w-[58ch] border-t border-border/60 pt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                    Los valores históricos son estimaciones basadas en posiciones actuales y precios históricos; pueden no reflejar el patrimonio exacto en fechas pasadas.
                  </p>
                </div>
              ) : (
                <EmptyPlaceholder text="Sin datos de patrimonio todavía" className="mt-4 h-52 sm:h-64" />
              )}
            </div>

            {/* Puntuación financiera */}
            <div className={`${CARD_HERO} flex min-w-0 flex-col 2xl:col-span-3`}>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Puntuación financiera</p>
              </div>
              <div className="relative mx-auto my-4 flex items-center justify-center">
                <CircularProgress value={score} size={136} strokeWidth={10} color={scoreColor} />
                <div className="absolute flex flex-col items-center">
                  <span className="text-4xl font-bold tabular-nums text-foreground">{score}</span>
                  <span className="text-xs text-muted-foreground">de 100</span>
                </div>
              </div>
              <p className="text-center text-sm font-semibold" style={{ color: scoreColor }}>{scoreDisplayLabel}</p>
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {scoreFactors.map((f) => (
                  <div key={f.label} className="flex items-center gap-2 text-xs">
                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full", f.ok ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground")}>
                      {f.ok ? <Check className="h-2.5 w-2.5" strokeWidth={2.2} /> : <Minus className="h-2.5 w-2.5" />}
                    </span>
                    <span className={f.ok ? "text-foreground" : "text-muted-foreground"}>{f.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-4 2xl:col-span-3">
            <div className={`${CARD} flex min-w-0 flex-col p-4 sm:p-4`}>
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Layers3 className="h-4 w-4 text-primary" /> Composición del patrimonio</p>
              {composicion.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Sin datos todavía.</p>
              ) : (
                <>
                  <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full">
                    {composicion.map((c) => (
                      <div key={c.tipo} style={{ width: `${c.pct}%`, backgroundColor: c.color }} title={c.label} />
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    {composicion.map((c) => (
                      <div key={c.tipo} className="flex items-center gap-2 text-xs">
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="text-foreground">{c.label}</span>
                        <span className="tabular-nums text-muted-foreground">{Math.round(c.pct)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5 text-amber-500" /> Racha de ahorro</span>
                  <span className="text-sm font-semibold tabular-nums text-foreground">{streak > 0 ? `${streak} ${streak === 1 ? "mes" : "meses"}` : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Mejor mes</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-500">{bestMonth ? <Sensitive>{formatMoney(bestMonth.value, "EUR")}</Sensitive> : "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-3.5 w-3.5 text-primary" /> Próximo objetivo</span>
                  <span className="truncate text-sm font-semibold tabular-nums text-foreground">{nextGoal ? <Sensitive>{formatMoney(nextGoal.objetivo, "EUR")}</Sensitive> : "—"}</span>
                </div>
              </div>
            </div>

            <div className={`${CARD} min-w-0 p-4 sm:p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="h-4 w-4" /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Tu camino financiero</p>
                  </div>
                </div>
                <span className="rounded-full border border-border/70 px-2 py-1 text-[10px] font-medium text-muted-foreground">3 hitos</span>
              </div>

              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Siguiente paso</p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">{goalGuidance.title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{goalGuidance.detail}</p>
                  </div>
                  <p className="shrink-0 text-right text-sm font-bold tabular-nums text-foreground"><Sensitive>{formatMoney(wealthMilestones[0], "EUR")}</Sensitive></p>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/80">
                  <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${milestoneProgress}%` }} />
                </div>
                <p className="mt-1.5 text-right text-[10px] tabular-nums text-muted-foreground"><Sensitive>{formatMoney(Math.max(wealthMilestones[0] - netWorthDisplay, 0), "EUR")}</Sensitive> restantes</p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2" aria-label="Próximos hitos de patrimonio">
                {wealthMilestones.map((milestone, index) => (
                  <div key={milestone} className={cn("min-w-0 rounded-xl border px-1.5 py-2.5 sm:px-2", index === 0 ? "border-primary/30 bg-primary/[0.07]" : "border-border/70 bg-background/35")}>
                    <p className="truncate text-[9px] uppercase tracking-wide text-muted-foreground">{index === 0 ? "Ahora" : `Hito ${index + 1}`}</p>
                    <p className={cn("mt-1 truncate text-[11px] font-semibold tabular-nums sm:text-xs", index === 0 ? "text-primary" : "text-foreground")}><Sensitive>{formatMoney(milestone, "EUR")}</Sensitive></p>
                  </div>
                ))}
              </div>
            </div>
            </div>
          </section>

          <section
            className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.85fr)] lg:gap-5"
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
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: catColor(c.categoria) }} />
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
            <div className={topSpending.length === 0 ? "w-full max-w-sm lg:justify-self-end" : "w-full"}>
              <EmergencyRunwayCard balanceEur={emergencyBalanceEur} />
            </div>
          </section>

          {/* Resumen, movimientos y metas comparten la última fila del panel. */}
          <section className="stagger-fade grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-4 xl:items-start" style={{ animationDelay: "240ms" }}>
            <div className={`${CARD} space-y-4`}>
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
                <p className="text-sm text-muted-foreground">
                  Neto anual:{" "}
                  <Sensitive as="span" className={cn("font-semibold tabular-nums", annualNeto >= 0 ? "text-emerald-500" : "text-red-500")}>
                    {formatMoney(annualNeto, "EUR")}
                  </Sensitive>
                </p>
              )}
              {showAnnual && (
                <div className="grid grid-cols-1 gap-3">
                  <AnnualStat label="Ingresos totales" year={year} value={annualIngresos} accent="var(--accent-green)" icon={ArrowUpRight}>
                    <MiniBars values={monthlyYear.map((m) => m.ingresos)} color="var(--accent-green)" />
                  </AnnualStat>
                  <AnnualStat label="Gastos totales" year={year} value={annualGastos} accent="var(--accent-red)" icon={ArrowDownRight}>
                    <MiniBars values={monthlyYear.map((m) => m.gastos)} color="var(--accent-red)" />
                  </AnnualStat>
                  <AnnualStat label="Ahorro neto anual" year={year} value={annualNeto} accent={annualNeto >= 0 ? "var(--accent-green)" : "var(--accent-red)"} icon={PiggyBank}>
                    <MiniBars values={monthlyYear.map((m) => m.neto)} color="var(--accent-blue)" signed />
                  </AnnualStat>
                </div>
              )}
            </div>
            <div className={`${CARD} min-w-0`}>
              <div className="mb-4 flex items-center justify-between">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Receipt className="h-4 w-4 text-primary" /> Últimos movimientos</p>
                <button onClick={() => router.push("/transactions")} className="text-xs font-medium text-primary transition-colors hover:opacity-70">Ver todos</button>
              </div>
              {recentTransactions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Sin movimientos todavía.</p>
              ) : (
                <div className="divide-y divide-border/70">
                  {recentTransactions.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", t.tipo === "ingreso" ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}
                        >
                          {accountName(t.cuenta_id).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{t.descripcion || t.categoria}</p>
                          <p className="truncate text-xs text-muted-foreground">{accountName(t.cuenta_id)}</p>
                        </div>
                      </div>
                      <span className={cn("shrink-0 text-sm font-semibold tabular-nums", (t.tipo === "ingreso" ? t.monto : -t.monto) >= 0 ? "text-emerald-500" : "text-red-500")}>
                        <Sensitive>{(t.tipo === "ingreso" ? t.monto : -t.monto) >= 0 ? "+" : "-"}{formatMoney(Math.abs(t.monto), state.accounts.find((a) => a.id === t.cuenta_id)?.currency ?? "EUR")}</Sensitive>
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
        <DialogContent className="sm:max-w-xl">
          {metricDetail && (
            <>
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
                      <div className="max-h-[42dvh] divide-y divide-border overflow-y-auto rounded-xl border border-border/70 px-3">
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
                    {(dashboardPeriod === "month" || dashboardPeriod === "previous") && (
                      <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => { const type = metricDetail === "gastos" ? "gasto" : "ingreso"; setMetricDetail(null); router.push(`/transactions?tipo=${type}&mes=${selectedMonth}`) }}>
                        Ver todos los movimientos
                      </Button>
                    )}
                  </>
                )}

                {metricDetail === "neto" && (
                  <div className="space-y-3 rounded-xl border border-border/70 p-4">
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Ingresos</span><Sensitive className="font-medium tabular-nums text-emerald-500">{formatMoney(periodTotals.ingresos, "EUR")}</Sensitive></div>
                    <div className="flex justify-between gap-3 text-sm"><span className="text-muted-foreground">Gastos</span><Sensitive className="font-medium tabular-nums text-red-500">−{formatMoney(periodTotals.gastos, "EUR")}</Sensitive></div>
                    <div className="flex justify-between gap-3 border-t border-border pt-3 text-sm"><span className="font-semibold">Tasa de ahorro</span><span className="font-semibold tabular-nums">{periodSavingsRate}%</span></div>
                    <p className="text-xs leading-5 text-muted-foreground">Ahorro neto = ingresos del periodo − gastos del periodo. Los traspasos entre tus cuentas no alteran este cálculo.</p>
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
                    <div className="max-h-[42dvh] divide-y divide-border overflow-y-auto rounded-xl border border-border/70 px-3">
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

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
    </div>
  )
}
