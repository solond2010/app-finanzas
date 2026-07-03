"use client"

import { useEffect, useMemo, useState } from "react"
import { AreaChart } from "@tremor/react"
import { ArrowDownRight, ArrowUpRight, CalendarClock, Check, ChevronLeft, ChevronRight, Pencil, Target, TrendingUp, X } from "lucide-react"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { ImportCsvButton } from "@/components/dashboard/import-csv-button"
import { getSetting, setSetting } from "@/lib/settings"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { TickerTile } from "@/components/shared/ticker-tile"
import { EmptyState, EmptyPlaceholder } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { useFinance, generateId } from "@/lib/store"
import { getCategoryBreakdown, getMonthTotalsByString, getSavingsRate, getUpcomingRecurring } from "@/lib/calculations"
import { useToast } from "@/components/ui/toast"
import { formatMonth, isInitialBalanceTransaction, chartFormatter } from "@/lib/format"
import { formatMoney } from "@/lib/currency"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[16px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
// Card del gráfico de evolución del cash flow: la vista analítica principal
// de la página, con el mismo tinte azul-marino que las demás "hero cards".
const CARD_HERO = "rounded-[16px] hero-panel p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const RANGES = [{ label: "1M", m: 1 }, { label: "3M", m: 3 }, { label: "6M", m: 6 }, { label: "1 año", m: 12 }]
const CashflowTooltip = createChartTooltip(["Ingresos", "Gastos"], ["blue", "red"])

function Gauge({ value, max, color = "var(--accent-blue)" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(value / max, 1)) : 0
  const len = Math.PI * 70
  return (
    <svg viewBox="0 0 180 104" className="w-full max-w-[210px]">
      <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="var(--muted)" strokeWidth="13" strokeLinecap="round" />
      <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" strokeDasharray={len} strokeDashoffset={len * (1 - pct)} className="transition-all duration-700 ease-out" />
    </svg>
  )
}

export default function IngresosGastosPage() {
  const { state, loading, dispatch } = useFinance()
  const { toast } = useToast()
  const today = useMemo(() => new Date(), [])
  const [monthOffset, setMonthOffset] = useState(0)
  const [rangeM, setRangeM] = useState(6)
  const [target, setTarget] = useState(2000)
  const [accIdx, setAccIdx] = useState(0)

  useEffect(() => {
    queueMicrotask(async () => {
      const local = Number(localStorage.getItem("income-target"))
      if (local > 0) setTarget(local)
      const remote = Number(await getSetting("income-target"))
      if (remote > 0) { setTarget(remote); try { localStorage.setItem("income-target", String(remote)) } catch {} }
      else if (local > 0) { setSetting("income-target", String(local)) } // migra local → nube
    })
  }, [])

  const editTarget = () => {
    const v = window.prompt("Objetivo de ingresos mensual (€)", String(target))
    if (v == null) return
    const n = Number(v)
    if (n > 0) {
      setTarget(n)
      try { localStorage.setItem("income-target", String(n)) } catch {}
      setSetting("income-target", String(n))
    }
  }

  const selectedDate = useMemo(() => new Date(today.getFullYear(), today.getMonth() - monthOffset, 1), [today, monthOffset])
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const savingsRate = getSavingsRate(monthTotals.ingresos, monthTotals.neto)

  // Próximos pagos: se calculan a partir de transacciones marcadas como
  // recurrentes (tag "recurrente"), no dependen del mes seleccionado en el
  // resto de la página — siempre miran hacia el próximo vencimiento real.
  const upcomingRecurring = useMemo(() => getUpcomingRecurring(state.transactions).slice(0, 4), [state.transactions])
  const registerRecurring = (item: ReturnType<typeof getUpcomingRecurring>[number]) => {
    dispatch({
      type: "ADD_TRANSACTION",
      payload: {
        id: generateId(),
        cuenta_id: item.cuenta_id,
        monto: item.monto,
        fecha: item.nextDate,
        tipo: item.tipo,
        categoria: item.categoria,
        es_necesidad: item.es_necesidad,
        descripcion: item.descripcion,
        tags: item.tags,
      },
    })
    toast("Pago registrado", "success")
  }
  // Sin esto, un pago cancelado (una suscripción dada de baja, p. ej.) se
  // queda marcado "recurrente" para siempre: como nadie vuelve a registrar un
  // pago nuevo de esa serie, "Atrasado Nd" crece sin parar cada vez más días.
  // Quita la etiqueta de la última transacción de la serie sin borrar el
  // historial — solo dice "esto ya no se repite".
  const stopRecurring = (item: ReturnType<typeof getUpcomingRecurring>[number]) => {
    const source = state.transactions.find((t) => t.id === item.sourceTransactionId)
    if (!source) return
    dispatch({ type: "UPDATE_TRANSACTION", payload: { ...source, tags: source.tags.filter((t) => t !== "recurrente" && !t.startsWith("recurrente:")) } })
    toast("Ya no se repetirá", "success")
  }
  const recurringDateLabel = (item: ReturnType<typeof getUpcomingRecurring>[number]) => {
    if (item.overdueDays > 0) return `Atrasado ${item.overdueDays}d`
    if (item.overdueDays === 0) return "Hoy"
    return new Date(item.nextDate).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
  }

  const totalBalance = state.accounts.reduce((s, a) => s + a.saldo, 0)
  const accCount = state.accounts.length
  const safeAccIdx = accCount > 0 ? ((accIdx % accCount) + accCount) % accCount : 0
  const currentAccount = state.accounts[safeAccIdx]

  const cashflow = useMemo(
    () => Array.from({ length: rangeM }, (_, i) => {
      const off = rangeM - 1 - i
      const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - off, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const t = getMonthTotalsByString(analysisTransactions, key)
      return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), Ingresos: t.ingresos, Gastos: t.gastos }
    }),
    [rangeM, selectedDate, analysisTransactions]
  )
  const cashflowHasData = cashflow.some((c) => c.Ingresos > 0 || c.Gastos > 0)
  const savingsRateTrend = useMemo(() => cashflow.map((c) => (c.Ingresos > 0 ? Math.max(((c.Ingresos - c.Gastos) / c.Ingresos) * 100, 0) : 0)), [cashflow])

  const categoryBreakdown = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const topCategory = categoryBreakdown[0]
  const categoryTotal = categoryBreakdown.reduce((sum, item) => sum + item.monto, 0)
  const topCategoryPct = topCategory && categoryTotal > 0 ? Math.round((topCategory.monto / categoryTotal) * 100) : 0

  // Mayor gasto individual del mes seleccionado, para el ticker superior.
  const biggestExpense = useMemo(
    () => analysisTransactions.filter((t) => t.tipo === "gasto" && t.fecha.startsWith(selectedMonth)).reduce((max, t) => (t.monto > max ? t.monto : max), 0),
    [analysisTransactions, selectedMonth]
  )

  return (
    <div className="content-fade w-full max-w-full space-y-6 overflow-x-hidden sm:space-y-7">
      {/* Cabecera */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Control financiero</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Ingresos y Gastos</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <ImportCsvButton />
          <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
            <button onClick={() => setMonthOffset((p) => p + 1)} aria-label="Mes anterior" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
            <span className="w-28 text-center text-sm font-medium text-foreground sm:w-32">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} aria-label="Mes siguiente" className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-90"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
        </div>
      ) : (
      <>
      {/* Ticker: pulso del mes */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <TickerTile label="Tasa de ahorro" value={`${savingsRate}%`} valueColor="var(--primary)" trend={savingsRateTrend} trendColor="blue" />
        <TickerTile label="Pagos pendientes" value={upcomingRecurring.length > 0 ? String(upcomingRecurring.length) : "Al día"} valueColor="var(--accent-amber)" />
        <TickerTile label="Mayor gasto" value={biggestExpense > 0 ? formatMoney(biggestExpense, "EUR") : "—"} valueColor="var(--accent-red)" />
        <TickerTile label="Categoría top" value={topCategory ? `${topCategoryPct}%` : "—"} detail={topCategory?.categoria} valueColor="var(--gold)" />
      </section>

      {/* Fila 1: Cuenta principal · Objetivo ingresos · Próximos pagos */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Cuenta (carrusel) */}
        <div className="relative min-w-0 overflow-hidden rounded-[16px] bg-primary p-5 text-white sm:p-6">
          <div className="flex items-center justify-between text-xs font-medium text-white/70">
            <div className="flex items-center gap-1">
              {accCount > 1 && (
                <>
                  <button onClick={() => setAccIdx((p) => p - 1)} aria-label="Cuenta anterior" className="rounded-full border border-white/25 p-1.5 text-white/80 transition-colors hover:bg-white/10 active:scale-90"><ChevronLeft className="h-4 w-4" /></button>
                  <button onClick={() => setAccIdx((p) => p + 1)} aria-label="Cuenta siguiente" className="rounded-full border border-white/25 p-1.5 text-white/80 transition-colors hover:bg-white/10 active:scale-90"><ChevronRight className="h-4 w-4" /></button>
                </>
              )}
            </div>
            <span>Todas: <Sensitive>{formatMoney(totalBalance, "EUR")}</Sensitive></span>
          </div>
          {currentAccount ? (
            <>
              <div className="mt-5 flex items-center gap-3">
                <AccountLogo account={currentAccount} className="h-11 w-11" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{currentAccount.nombre}</p>
                  <p className="truncate text-xs text-white/70">{currentAccount.banco || "Cuenta corriente"}</p>
                </div>
              </div>
              <p className="mt-4 text-3xl font-bold tabular-nums tracking-tight">
                <Sensitive>{formatMoney(currentAccount.saldo, currentAccount.currency)}</Sensitive>
              </p>
              {accCount > 1 && (
                <div className="mt-4 flex items-center gap-1.5">
                  {state.accounts.map((a, i) => (
                    <button key={a.id} onClick={() => setAccIdx(i)} aria-label={`Ver ${a.nombre}`} className={cn("h-1.5 rounded-full transition-all", i === safeAccIdx ? "w-5 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50")} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="mt-8 text-sm text-white/80">Aún no tienes cuentas. Créalas en la sección Cuentas.</p>
          )}
        </div>

        {/* Objetivo ingresos mensual */}
        <div className={`${CARD} min-w-0`}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Target className="h-4 w-4 text-primary" /> Objetivo de ingresos</p>
            <button onClick={editTarget} aria-label="Editar objetivo" className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mt-2 flex flex-col items-center">
            <Gauge value={monthTotals.ingresos} max={target} />
            <p className="-mt-6 text-2xl font-bold tabular-nums text-foreground"><Sensitive>{formatMoney(monthTotals.ingresos, "EUR")}</Sensitive></p>
            <div className="mt-1 flex w-full max-w-[210px] justify-between text-[11px] font-medium text-muted-foreground">
              <span>€0</span>
              <span>de {formatMoney(target, "EUR")}</span>
            </div>
          </div>
        </div>

        {/* Próximos pagos */}
        <div className={`${CARD} flex min-w-0 flex-col`}>
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarClock className="h-4 w-4 text-primary" /> Próximos pagos</p>
          {upcomingRecurring.length === 0 ? (
            <EmptyState className="flex-1 py-8" icon={CalendarClock} title="Sin pagos programados" description="Marca transacciones como recurrentes para verlas aquí." />
          ) : (
            <div className="mt-3 flex-1 space-y-2">
              {upcomingRecurring.map((item) => (
                <div key={item.key} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{item.descripcion || item.categoria}</p>
                    <p className={cn("text-[11px] font-medium", item.overdueDays > 0 ? "text-red-500" : "text-muted-foreground")}>
                      {recurringDateLabel(item)}
                      {item.frequency !== "mensual" && ` · ${item.frequency === "semanal" ? "Semanal" : "Anual"}`}
                    </p>
                  </div>
                  <span className={cn("shrink-0 text-xs font-bold tabular-nums", (item.tipo === "ingreso" ? item.monto : -item.monto) >= 0 ? "text-emerald-500" : "text-foreground")}>
                    <Sensitive>{(item.tipo === "ingreso" ? item.monto : -item.monto) >= 0 ? "+" : "-"}{formatMoney(Math.abs(item.monto), "EUR")}</Sensitive>
                  </span>
                  <button onClick={() => stopRecurring(item)} aria-label="Dejar de repetir" title="Dejar de repetir" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500">
                    <X className="h-4 w-4" />
                  </button>
                  <button onClick={() => registerRecurring(item)} aria-label="Registrar pago" title="Registrar pago" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-500">
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Fila 2: Cash flow + balance */}
      <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
        <div className={`${CARD_HERO} min-w-0 lg:col-span-2`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><TrendingUp className="h-4 w-4 text-primary" /> Evolución del cash flow</p>
            <div className="range-tabs">
              {RANGES.map((r) => (
                <button key={r.m} onClick={() => setRangeM(r.m)} data-active={rangeM === r.m} className="range-tab">{r.label}</button>
              ))}
            </div>
          </div>
          {cashflowHasData ? (
            <div role="img" aria-label="Gráfico de área: evolución de ingresos y gastos por mes">
              <AreaChart data={cashflow} index="mes" categories={["Ingresos", "Gastos"]} colors={["blue", "red"]} valueFormatter={chartFormatter} showLegend showGridLines={false} customTooltip={CashflowTooltip} className="mt-2 h-64 sm:h-72" curveType="monotone" showAnimation />
            </div>
          ) : (
            <EmptyPlaceholder text="Sin movimientos en este periodo" className="mt-2 h-64 sm:h-72" />
          )}
        </div>

        {/* Balance */}
        <div className={`${CARD} flex min-w-0 flex-col gap-4`}>
          <div>
            <p className="page-section-label">Balance · {formatMonth(selectedDate)}</p>
            <p className={cn("mt-1 text-3xl font-bold tabular-nums tracking-tight", monthTotals.neto >= 0 ? "text-foreground" : "text-red-500")}>
              <Sensitive><AnimatedNumber value={monthTotals.neto} prefix={monthTotals.neto >= 0 ? "+" : ""} /></Sensitive>
            </p>
            <p className="mt-1 text-xs"><span className={cn("font-semibold", savingsRate >= 0 ? "text-emerald-500" : "text-red-500")}>{savingsRate}%</span> <span className="text-muted-foreground">de ahorro este mes</span></p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ingresos</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500"><ArrowUpRight className="h-4 w-4" /></span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-emerald-500"><Sensitive><AnimatedNumber value={monthTotals.ingresos} prefix={monthTotals.ingresos > 0 ? "+" : ""} /></Sensitive></p>
          </div>
          <div className="rounded-2xl border border-border p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Gastos</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10 text-red-500"><ArrowDownRight className="h-4 w-4" /></span>
            </div>
            <p className="mt-1 text-xl font-bold tabular-nums text-red-500"><Sensitive><AnimatedNumber value={monthTotals.gastos} prefix={monthTotals.gastos > 0 ? "-" : ""} /></Sensitive></p>
          </div>
        </div>
      </section>
      </>
      )}

      {/* Planes de ahorro */}
      <SinkingFundsGrid />

      {/* Transacciones */}
      <TransactionsTable selectedMonth={selectedMonth} />
    </div>
  )
}
