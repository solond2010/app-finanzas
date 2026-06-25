"use client"

import { useEffect, useMemo, useState } from "react"
import { BarChart, DonutChart, LineChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, FlaskConical, Gauge, Layers3, PiggyBank, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { buildMonthlyCashFlow, buildMonthlySummariesUpTo, buildNetWorthHistory, getCategoryBreakdown, getMonthTotalsByString, getNeedsVsWantsForMonth } from "@/lib/calculations"
import { backupCurrentState, clearBackup, generateSampleData, restoreBackup, useFinance } from "@/lib/store"
import { useAnimatedNumber } from "@/lib/hooks/use-animated-number"

const money = (value: number) => `${value.toLocaleString("es-ES")}€`
const signedMoney = (value: number) => `${value >= 0 ? "+" : ""}${money(value)}`
const chartFormatter = (value: number) => money(value)

function isInitialBalanceTransaction(id: string) {
  return id.startsWith("init_")
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

function AnimatedNumber({ value, prefix = "", suffix = "€" }: { value: number; prefix?: string; suffix?: string }) {
  const animated = useAnimatedNumber(Math.round(value))
  return <>{prefix}{animated.toLocaleString("es-ES")}{suffix}</>
}

function EmptyPanel({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 text-center ring-1 ring-border/20">
      <div className="rounded-2xl bg-background/70 p-3 ring-1 ring-border/20">
        <Icon className="h-6 w-6 text-muted-foreground/45" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  subtitle,
  icon: Icon,
  tone,
  delay,
}: {
  label: string
  value: React.ReactNode
  subtitle: string
  icon: React.ElementType
  tone: "emerald" | "red" | "blue" | "amber" | "violet"
  delay: number
}) {
  const tones = {
    emerald: "from-emerald-500/12 to-emerald-500/[0.02] text-emerald-500 ring-emerald-500/15",
    red: "from-red-500/12 to-red-500/[0.02] text-red-500 ring-red-500/15",
    blue: "from-blue-500/12 to-blue-500/[0.02] text-blue-500 ring-blue-500/15",
    amber: "from-amber-500/12 to-amber-500/[0.02] text-amber-500 ring-amber-500/15",
    violet: "from-violet-500/12 to-violet-500/[0.02] text-violet-500 ring-violet-500/15",
  }

  return (
    <div
      className="stagger-fade relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${tones[tone]} opacity-75`} />
      <div className="relative z-10 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
          <div className={`rounded-2xl bg-background/60 p-2.5 ring-1 ${tones[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="text-[30px] font-bold leading-none tracking-tight tabular-nums sm:text-[32px]">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ label, title, text }: { label: string; title: string; text?: string }) {
  return (
    <div className="col-span-full flex flex-col gap-1 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {text && <p className="max-w-xl text-sm text-muted-foreground">{text}</p>}
      </div>
    </div>
  )
}

function RuleCard({ label, target, actual, value, tone, delay }: { label: string; target: number; actual: number; value: number; tone: string; delay: number }) {
  const diff = actual - target
  const width = Math.min(Math.max(actual, 0), 100)
  const good = Math.abs(diff) <= 6 || (label.includes("Ahorro") && actual >= target)

  return (
    <div className="stagger-fade rounded-[22px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
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
}

export default function AnalyticsPage() {
  const { state, dispatch } = useFinance()
  const [hasBackup, setHasBackup] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)

  useEffect(() => {
    setHasBackup(localStorage.getItem("app-finanzas-backup") !== null)
  }, [])

  const today = new Date()
  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasData = analysisTransactions.length > 0

  const loadSampleData = () => {
    if (!window.confirm("¿Añadir datos de ejemplo? Tus datos actuales se conservarán.")) return
    backupCurrentState(state)
    dispatch({ type: "MERGE_SAMPLE", payload: generateSampleData() })
    setHasBackup(true)
  }

  const restoreMyData = () => {
    const backup = restoreBackup()
    if (!backup) return
    dispatch({ type: "SET_STATE", payload: backup })
    clearBackup()
    setHasBackup(false)
  }

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
  const savingsTargetValue = monthTotals.ingresos * 0.2
  const topCategory = categoryBreakdown[0]
  const categoryTotal = categoryBreakdown.reduce((sum, item) => sum + item.monto, 0)
  const topCategoryPct = topCategory && categoryTotal > 0 ? Math.round((topCategory.monto / categoryTotal) * 100) : 0
  const averageMonthlyNet = cashFlow.length > 0 ? Math.round(cashFlow.reduce((sum, item) => sum + item.neto, 0) / cashFlow.length) : 0
  const positiveMonths = cashFlow.filter((item) => item.neto >= 0).length
  const netWorthTrendPositive = netWorthChange >= 0

  const needsWantsData = [
    { name: "Necesidades", value: necesidades },
    { name: "Deseos", value: deseos },
  ]

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[32px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.14),transparent_30%)] dark:bg-[radial-gradient(circle_at_10%_10%,rgba(16,185,129,0.28),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.24),transparent_30%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Centro de inteligencia financiera
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Analíticas</p>
              <h1 className="max-w-3xl text-[34px] font-bold leading-[0.95] tracking-tight sm:text-[44px] lg:text-[52px]">Entiende tu dinero sin leer una hoja de cálculo.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Patrimonio, cash flow, hábitos de gasto y regla 50/30/20 en una vista pensada para tomar decisiones.</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[310px] lg:items-end">
            <div className="flex items-center gap-2 rounded-2xl bg-background/70 px-3 py-2 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
              <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[165px] text-center text-sm font-bold capitalize tracking-tight">{formatMonth(selectedDate)}</span>
              <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
              {hasBackup && <Button variant="outline" size="sm" className="border-emerald-500/30 text-emerald-600" onClick={restoreMyData}>Restaurar mis datos</Button>}
              <Button variant="outline" size="sm" className="gap-2" onClick={loadSampleData}><FlaskConical className="h-4 w-4" />Datos ejemplo</Button>
              {hasData && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => window.confirm("¿Borrar todos los datos?") && dispatch({ type: "RESET" })}>Limpiar</Button>}
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Patrimonio" value={<AnimatedNumber value={Math.round(currentNetWorth)} />} subtitle={`${netWorthTrendPositive ? "Sube" : "Baja"} ${signedMoney(netWorthChange)} vs mes previo`} icon={Wallet} tone={netWorthTrendPositive ? "emerald" : "red"} delay={0} />
        <MetricCard label="Ingresos" value={<AnimatedNumber value={monthTotals.ingresos} prefix="+" />} subtitle={`Registrados en ${formatMonth(selectedDate)}`} icon={ArrowUpRight} tone="emerald" delay={70} />
        <MetricCard label="Gastos" value={<AnimatedNumber value={monthTotals.gastos} prefix="-" />} subtitle={topCategory ? `${topCategory.categoria} concentra el ${topCategoryPct}%` : "Sin gastos este mes"} icon={ArrowDownRight} tone="red" delay={140} />
        <MetricCard label="Neto" value={<AnimatedNumber value={monthTotals.neto} />} subtitle={`${positiveMonths}/6 meses con cash flow positivo`} icon={Activity} tone={monthTotals.neto >= 0 ? "blue" : "amber"} delay={210} />
      </section>

      <section className="grid grid-cols-12 gap-6">
        <SectionTitle label="Tendencia" title="El pulso de los últimos 6 meses" text="Patrimonio histórico y evolución mensual para detectar si estás acumulando o drenando capital." />

        <Card className="stagger-fade col-span-full xl:col-span-7" style={{ animationDelay: "80ms" }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold"><TrendingUp className="h-4 w-4 text-emerald-500" />Patrimonio neto</CardTitle>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${netWorthTrendPositive ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>{signedMoney(netWorthChange)}</span>
          </CardHeader>
          <CardContent>
            {state.accounts.length === 0 ? <EmptyPanel icon={Wallet} title="Sin patrimonio registrado" text="Crea cuentas para ver la evolución de tu riqueza neta." /> : (
              <LineChart data={netWorthHistory} index="mes" categories={["patrimonio"]} colors={["emerald"]} valueFormatter={chartFormatter} yAxisWidth={72} className="h-[310px]" showAnimation />
            )}
          </CardContent>
        </Card>

        <Card className="stagger-fade col-span-full xl:col-span-5" style={{ animationDelay: "140ms" }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold"><BarChart3 className="h-4 w-4 text-muted-foreground" />Ingresos vs gastos</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? <EmptyPanel icon={BarChart3} title="Aún no hay movimientos" text="Añade ingresos y gastos para comparar tu ritmo mensual." /> : (
              <BarChart data={summaries} index="mes" categories={["ingresos", "gastos"]} colors={["emerald", "red"]} valueFormatter={chartFormatter} yAxisWidth={64} className="h-[310px]" showAnimation />
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
            {categoryBreakdown.length === 0 ? <EmptyPanel icon={Layers3} title="Sin gasto categorizado" text="Cuando registres gastos, aquí verás las categorías que más pesan." /> : (
              <BarChart data={categoryBreakdown.slice(0, 8)} index="categoria" categories={["monto"]} colors={["violet"]} valueFormatter={chartFormatter} yAxisWidth={72} className="h-[340px]" showAnimation layout="vertical" />
            )}
          </CardContent>
        </Card>

        <div className="col-span-full grid gap-6 lg:col-span-5">
          <Card className="stagger-fade" style={{ animationDelay: "230ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold"><Gauge className="h-4 w-4 text-amber-500" />Necesidades vs deseos</CardTitle>
            </CardHeader>
            <CardContent>
              {totalSpending === 0 ? <EmptyPanel icon={Gauge} title="Sin gastos este mes" text="La distribución aparecerá al registrar necesidades y deseos." /> : (
                <div className="grid gap-5 sm:grid-cols-[180px_1fr] sm:items-center lg:grid-cols-1 xl:grid-cols-[180px_1fr]">
                  <DonutChart data={needsWantsData} category="value" index="name" colors={["emerald", "amber"]} variant="donut" className="mx-auto h-44 w-44" showAnimation />
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-emerald-500/[0.05] p-3 ring-1 ring-emerald-500/10">
                      <div className="flex items-center justify-between text-sm"><span>Necesidades</span><strong className="text-emerald-500 tabular-nums">{Math.round(needsPct)}%</strong></div>
                      <p className="mt-1 text-xs text-muted-foreground">{money(necesidades)}</p>
                    </div>
                    <div className="rounded-2xl bg-amber-500/[0.05] p-3 ring-1 ring-amber-500/10">
                      <div className="flex items-center justify-between text-sm"><span>Deseos</span><strong className="text-amber-500 tabular-nums">{Math.round(wantsPct)}%</strong></div>
                      <p className="mt-1 text-xs text-muted-foreground">{money(deseos)}</p>
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
                <p className={`mt-1 text-2xl font-bold tabular-nums ${averageMonthlyNet >= 0 ? "text-emerald-500" : "text-red-500"}`}>{signedMoney(averageMonthlyNet)}</p>
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
          <RuleCard label="50% Necesidades" target={50} actual={needsPct} value={necesidades} tone="#10b981" delay={100} />
          <RuleCard label="30% Deseos" target={30} actual={wantsPct} value={deseos} tone="#f59e0b" delay={170} />
          <RuleCard label="20% Ahorro" target={20} actual={savingsActual} value={savingsTargetValue} tone="#3b82f6" delay={240} />
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
                    <TableCell colSpan={5} className="py-14"><EmptyPanel icon={CircleDollarSign} title="Sin cash flow" text="Registra movimientos para construir tu histórico mensual." /></TableCell>
                  </TableRow>
                ) : (
                  cashFlow.slice().reverse().map((month) => (
                    <TableRow key={month.mes}>
                      <TableCell className="font-medium capitalize">{month.mes}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-500">+{money(month.ingresos)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-red-500">-{money(month.gastos)}</TableCell>
                      <TableCell className={`text-right font-bold tabular-nums ${month.neto >= 0 ? "text-emerald-500" : "text-red-500"}`}>{signedMoney(month.neto)}</TableCell>
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
    </div>
  )
}
