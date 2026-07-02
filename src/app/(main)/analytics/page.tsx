"use client"

import { useMemo, useState, memo } from "react"
import { BarChart, DonutChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, Gauge, Layers3, PiggyBank, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MetricCard } from "@/components/dashboard/metric-card"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { MountainChart } from "@/components/shared/mountain-chart"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { TickerTile } from "@/components/shared/ticker-tile"
import { buildMonthlyCashFlow, buildMonthlySummariesUpTo, buildNetWorthHistory, getCategoryBreakdown, getMonthTotalsByString, getNeedsVsWantsForMonth } from "@/lib/calculations"
import { useFinance } from "@/lib/store"
import { money, signedMoney, chartFormatter, formatMonth, isInitialBalanceTransaction } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Sensitive } from "@/components/shared/sensitive"

const SummaryTooltip = createChartTooltip(["ingresos", "gastos"], ["emerald", "red"])
const CategoryTooltip = createChartTooltip(["monto"], ["violet"])
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
    <div className="stagger-fade glass-card rounded-[22px] p-5 card-glow glass-card-hover" style={{ animationDelay: `${delay}ms` }}>
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

export default function AnalyticsPage() {
  const { state, loading, dispatch } = useFinance()
  const [monthOffset, setMonthOffset] = useState(0)

  const today = new Date()
  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasData = analysisTransactions.length > 0

  const [confirmReset, setConfirmReset] = useState(false)

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const { necesidades, deseos } = useMemo(() => getNeedsVsWantsForMonth(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const summaries = useMemo(() => buildMonthlySummariesUpTo(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const cashFlow = useMemo(() => buildMonthlyCashFlow(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const netWorthHistory = useMemo(() => buildNetWorthHistory(state.transactions, state.accounts, selectedMonth), [state.transactions, state.accounts, selectedMonth])

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
  const averageMonthlyNet = cashFlow.length > 0 ? Math.round(cashFlow.reduce((sum, item) => sum + item.neto, 0) / cashFlow.length) : 0
  const positiveMonths = cashFlow.filter((item) => item.neto >= 0).length
  const netWorthTrendPositive = netWorthChange >= 0
  const isAllTimeHigh = netWorthTrendPositive && netWorthHistory.length > 0 && currentNetWorth >= Math.max(...netWorthHistory.map((n) => n.patrimonio))

  // Racha de meses consecutivos con flujo de caja positivo, contando hacia
  // atrás desde el mes seleccionado dentro de la ventana de 6 meses visible.
  const streak = useMemo(() => {
    let count = 0
    for (let i = cashFlow.length - 1; i >= 0; i--) {
      if (cashFlow[i].neto < 0) break
      count++
    }
    return count
  }, [cashFlow])
  const savingsRateTrend = useMemo(() => cashFlow.map((c) => (c.ingresos > 0 ? Math.max((c.neto / c.ingresos) * 100, 0) : 0)), [cashFlow])

  const needsWantsData = [
    { name: "Necesidades", value: necesidades },
    { name: "Deseos", value: deseos },
  ]

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <section className="hero-gradient rounded-[24px] bg-card/70 p-6 sm:p-8 card-glow">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Centro de inteligencia financiera
            </div>
            <div className="space-y-2">
              <p className="page-section-label">Analíticas</p>
              <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Entiende tu dinero sin leer una hoja de cálculo.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Patrimonio, cash flow, hábitos de gasto y regla 50/30/20 en una vista pensada para tomar decisiones.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[310px] lg:items-end">
            <div className="flex items-center gap-2 rounded-2xl bg-background/70 px-3 py-2 card-glow">
              <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[165px] text-center text-sm font-bold capitalize tracking-tight">{formatMonth(selectedDate)}</span>
              <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              {hasData && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmReset(true)}>Limpiar</Button>}
            </div>
          </div>
        </div>
      </section>

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
        <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix="+" />} subtitle={`Registrados en ${formatMonth(selectedDate)}`} icon={ArrowUpRight} tone="emerald" delay={70} />
        <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix="-" />} subtitle={topCategory ? `${topCategory.categoria} concentra el ${topCategoryPct}%` : "Sin gastos este mes"} icon={ArrowDownRight} tone="red" delay={140} />
        <MetricCard label="Neto" value={<AnimatedNumber value={monthTotals.neto} />} subtitle={`${positiveMonths}/6 meses con cash flow positivo`} icon={Activity} tone={monthTotals.neto >= 0 ? "blue" : "amber"} delay={210} />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <TickerTile label="Tasa de ahorro" value={`${Math.round(savingsActual)}%`} valueColor="var(--primary)" trend={savingsRateTrend} trendColor="blue" />
        <TickerTile label="Racha positiva" value={streak > 0 ? `${streak} ${streak === 1 ? "mes" : "meses"}` : "—"} valueColor="var(--accent-amber)" />
        <TickerTile label="Cash flow medio" value={signedMoney(averageMonthlyNet)} valueColor={averageMonthlyNet >= 0 ? "var(--accent-green)" : "var(--accent-red)"} />
        <TickerTile label="Categoría top" value={topCategory ? `${topCategory.categoria} · ${topCategoryPct}%` : "—"} valueColor="var(--gold)" />
      </section>

      <section className="grid grid-cols-12 gap-6">
        <SectionTitle label="Tendencia" title="El pulso de los últimos 6 meses" text="Patrimonio histórico y evolución mensual para detectar si estás acumulando o drenando capital." />

        <Card className="stagger-fade hero-panel col-span-full xl:col-span-7" style={{ animationDelay: "80ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <TrendingUp className="h-4 w-4 text-emerald-500" />Patrimonio neto
              {isAllTimeHigh && <span className="gold-badge rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">Máximo histórico</span>}
            </CardTitle>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${netWorthTrendPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}><Sensitive>{signedMoney(netWorthChange)}</Sensitive></span>
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
              <BarChart data={summaries} index="mes" categories={["ingresos", "gastos"]} colors={["emerald", "red"]} valueFormatter={chartFormatter} yAxisWidth={64} customTooltip={SummaryTooltip} className="h-[310px]" showAnimation />
            )}
          </CardContent>
        </Card>

        <SectionTitle label="Gasto" title="Dónde se está yendo el dinero" text="El objetivo no es ver barras bonitas: es encontrar el agujero más grande primero." />

        <Card className="stagger-fade col-span-full lg:col-span-7" style={{ animationDelay: "180ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold"><Layers3 className="h-4 w-4 text-violet-500" />Gastos por categoría</CardTitle>
            {topCategory && <span className="text-xs text-muted-foreground">Top: <strong className="text-foreground">{topCategory.categoria}</strong></span>}
          </CardHeader>
          <CardContent>
            {categoryBreakdown.length === 0 ? <EmptyState icon={Layers3} title="Sin gasto categorizado" description="Cuando registres gastos, aquí verás las categorías que más pesan." bordered className="h-full" /> : (
              <BarChart data={categoryBreakdown.slice(0, 8)} index="categoria" categories={["monto"]} colors={["violet"]} valueFormatter={chartFormatter} yAxisWidth={72} customTooltip={CategoryTooltip} className="h-[340px]" showAnimation layout="vertical" />
            )}
          </CardContent>
        </Card>

        <div className="col-span-full grid gap-6 lg:col-span-5">
          <Card className="stagger-fade" style={{ animationDelay: "230ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold"><Gauge className="h-4 w-4 text-amber-500" />Necesidades vs deseos</CardTitle>
            </CardHeader>
            <CardContent>
              {totalSpending === 0 ? <EmptyState icon={Gauge} title="Sin gastos este mes" description="La distribución aparecerá al registrar necesidades y deseos." bordered className="h-full" /> : (
                <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center lg:grid-cols-1 xl:grid-cols-[180px_1fr]">
                  <DonutChart data={needsWantsData} category="value" index="name" colors={["emerald", "amber"]} variant="donut" customTooltip={NeedsWantsTooltip} className="mx-auto h-44 w-44" showAnimation />
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
                <p className="text-xs text-muted-foreground">Cash flow medio 6 meses</p>
                <p className={`mt-1 text-2xl font-bold tabular-nums ${averageMonthlyNet >= 0 ? "text-emerald-500" : "text-red-500"}`}><Sensitive>{signedMoney(averageMonthlyNet)}</Sensitive></p>
              </div>
              <div className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/20">
                <p className="text-xs text-muted-foreground">Recomendación</p>
                <p className="mt-1 text-sm font-medium leading-6">{monthTotals.neto >= 0 ? "Buen mes. Mantén el ahorro automático y revisa si puedes subir aportaciones." : "Mes negativo. Revisa categorías grandes y congela gastos variables unos días."}</p>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <TableCell className="text-right font-semibold tabular-nums text-red-500"><Sensitive>-{money(month.gastos)}</Sensitive></TableCell>
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
