"use client"

import { useMemo, useEffect, useState, Fragment } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DonutChart, BarChart, LineChart, Legend } from "@tremor/react"
import { useAnimatedNumber } from "@/lib/hooks/use-animated-number"
import { useFinance, generateSampleData, backupCurrentState, restoreBackup, clearBackup } from "@/lib/store"
import {
  getNeedsVsWantsForMonth,
  getCategoryBreakdown,
  buildMonthlySummariesUpTo,
  buildMonthlyCashFlow,
  buildNetWorthHistory,
} from "@/lib/calculations"
import { BarChart3, PieChart, TrendingUp, Wallet, FlaskConical, ChevronLeft, ChevronRight, Euro, ArrowUpRight, ArrowDownRight } from "lucide-react"

const dataFormatter = (value: number) => `${value.toLocaleString("es-ES")}€`

function AnimatedValue({ value, suffix = "€" }: { value: number; suffix?: string }) {
  const animated = useAnimatedNumber(value)
  return <>{animated.toLocaleString("es-ES")}{suffix}</>
}

export default function AnalyticsPage() {
  const { state, dispatch } = useFinance()

  const [hasBackup, setHasBackup] = useState(false)
  const [monthOffset, setMonthOffset] = useState(0)
  useEffect(() => {
    setHasBackup(localStorage.getItem("app-finanzas-backup") !== null)
  }, [])
  const hasData = state.transactions.length > 0
  const today = new Date()
  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const loadSampleData = () => {
    if (!window.confirm("¿Añadir datos de ejemplo? Tus datos actuales se conservarán.")) return
    backupCurrentState(state)
    const sample = generateSampleData()
    dispatch({ type: "MERGE_SAMPLE", payload: sample })
  }

  const restoreMyData = () => {
    const backup = restoreBackup()
    if (backup) {
      dispatch({ type: "SET_STATE", payload: backup })
      clearBackup()
      setHasBackup(false)
    }
  }

  const { necesidades, deseos } = useMemo(() => getNeedsVsWantsForMonth(state.transactions, selectedMonth), [state.transactions, selectedMonth])
  const categoryBreakdown = useMemo(() => getCategoryBreakdown(state.transactions, selectedMonth), [state.transactions, selectedMonth])
  const summaries = useMemo(() => buildMonthlySummariesUpTo(state.transactions, selectedMonth), [state.transactions, selectedMonth])
  const cashFlow = useMemo(() => buildMonthlyCashFlow(state.transactions, selectedMonth), [state.transactions, selectedMonth])
  const netWorthHistory = useMemo(() => buildNetWorthHistory(state.transactions, state.accounts, selectedMonth), [state.transactions, state.accounts, selectedMonth])

  const needsWantsData = [
    { name: "Necesidades", value: necesidades },
    { name: "Deseos", value: deseos },
  ]
  const panelClass = ""

  const { ingresos: mesIngresos, gastos: mesGastos } = useMemo(() => {
    const filtered = state.transactions.filter((t) => t.fecha.startsWith(selectedMonth))
    return {
      ingresos: filtered.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0),
      gastos: filtered.filter((t) => t.tipo === "gasto").reduce((s, t) => s + t.monto, 0),
    }
  }, [state.transactions, selectedMonth])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-[28px] bg-card/60 backdrop-blur-xl p-7 shadow-sm ring-1 ring-border/30 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">Analíticas</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight sm:text-[32px]">Visualización de Datos</h1>
          <p className="text-sm text-muted-foreground">Ingresos, gastos y evolución del patrimonio.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2 rounded-2xl bg-muted/60 backdrop-blur-sm px-3 py-2 ring-1 ring-border/20">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-semibold capitalize tracking-tight">{selectedDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {hasBackup && (
              <Button variant="outline" size="sm" className="gap-2 text-emerald-600 border-emerald-500/30" onClick={restoreMyData}>
                Restaurar mis datos
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={loadSampleData}>
              <FlaskConical className="h-4 w-4" />
              Cargar datos de ejemplo
            </Button>
            {hasData && (
              <Button variant="ghost" size="sm" className="gap-2 text-destructive" onClick={() => window.confirm("¿Borrar todos los datos?") && dispatch({ type: "RESET" })}>
                Limpiar todo
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="stagger-fade col-span-full" style={{ animationDelay: "0ms" }}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Evolución del Patrimonio Neto
              </CardTitle>
              {hasData && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-0.5 text-emerald-500">
                    <ArrowUpRight className="h-3 w-3" />
                    {netWorthHistory.length > 1
                      ? `${((netWorthHistory[netWorthHistory.length - 1]?.patrimonio ?? 0) - (netWorthHistory[0]?.patrimonio ?? 0)).toLocaleString("es-ES")}€`
                      : "—"}
                  </span>
                  <span>total</span>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!hasData ? (
                <div className="h-56 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
                  <span>Añade transacciones para ver la evolución</span>
                </div>
              ) : (
                <LineChart
                  data={netWorthHistory}
                  index="mes"
                  categories={["patrimonio"]}
                  colors={["emerald"]}
                  valueFormatter={dataFormatter}
                  yAxisWidth={70}
                  className="h-56"
                  showAnimation
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="stagger-fade col-span-full md:col-span-5" style={{ animationDelay: "100ms" }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Cash Flow Mensual
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mes</TableHead>
                    <TableHead className="text-right">Ingresos</TableHead>
                    <TableHead className="text-right">Gastos</TableHead>
                    <TableHead className="text-right">Neto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!hasData ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2">
                          <Wallet className="h-6 w-6 text-muted-foreground/30" />
                          <span className="text-sm text-muted-foreground">Añade transacciones para ver el cash flow</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashFlow.slice().reverse().map((m) => (
                      <TableRow key={m.mes}>
                        <TableCell className="font-medium text-sm capitalize">{m.mes}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-500 text-sm font-medium">+{m.ingresos.toLocaleString("es-ES")}€</TableCell>
                        <TableCell className="text-right tabular-nums text-red-500 text-sm font-medium">-{m.gastos.toLocaleString("es-ES")}€</TableCell>
                        <TableCell className={`text-right tabular-nums font-medium text-sm ${m.neto >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                          {m.neto >= 0 ? "+" : ""}{m.neto.toLocaleString("es-ES")}€
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="stagger-fade col-span-full md:col-span-7" style={{ animationDelay: "150ms" }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Ingresos vs Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hasData ? (
                <div className="h-56 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
                  <span>Añade transacciones para ver el gráfico</span>
                </div>
              ) : (
                <BarChart
                  data={summaries}
                  index="mes"
                  categories={["ingresos", "gastos"]}
                  colors={["emerald", "red"]}
                  valueFormatter={dataFormatter}
                  yAxisWidth={70}
                  className="h-56"
                  showAnimation
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="stagger-fade col-span-full md:col-span-4" style={{ animationDelay: "200ms" }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                Necesidades vs Deseos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              {!hasData || (necesidades === 0 && deseos === 0) ? (
                <div className="h-44 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <PieChart className="h-8 w-8 text-muted-foreground/30" />
                  <span>Sin datos este mes</span>
                </div>
              ) : (
                <>
                  <DonutChart data={needsWantsData} category="value" index="name" colors={["emerald", "amber"]} variant="donut" className="h-44 w-44" showAnimation />
                  <Legend categories={["Necesidades", "Deseos"]} colors={["emerald", "amber"]} className="mt-3" />
                  <div className="mt-3 flex gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                      <span className="tabular-nums">{necesidades.toLocaleString("es-ES")}€</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      <span className="tabular-nums">{deseos.toLocaleString("es-ES")}€</span>
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="stagger-fade col-span-full md:col-span-8" style={{ animationDelay: "250ms" }}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                Gastos por Categoría
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hasData ? (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
                  <span>Añade transacciones para ver el gráfico</span>
                </div>
              ) : categoryBreakdown.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Sin gastos este mes</div>
              ) : (
                <BarChart data={categoryBreakdown} index="categoria" categories={["monto"]} colors={["violet"]} valueFormatter={dataFormatter} yAxisWidth={60} className="h-64" showAnimation layout="vertical" />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="stagger-fade col-span-full" style={{ animationDelay: "300ms" }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">Regla 50/30/20</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/15 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/10">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">50% Necesidades</p>
              <p className="text-[28px] font-bold tabular-nums text-emerald-500 leading-none">
                {hasData ? <AnimatedValue value={necesidades} /> : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {necesidades + deseos > 0 ? `${Math.round((necesidades / (necesidades + deseos)) * 100)}% del gasto` : "Sin datos"}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-500/[0.04] ring-1 ring-amber-500/15 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-amber-500/10">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">30% Deseos</p>
              <p className="text-[28px] font-bold tabular-nums text-amber-500 leading-none">
                {hasData ? <AnimatedValue value={deseos} /> : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {necesidades + deseos > 0 ? `${Math.round((deseos / (necesidades + deseos)) * 100)}% del gasto` : "Sin datos"}
              </p>
            </div>
            <div className="rounded-2xl bg-blue-500/[0.04] ring-1 ring-blue-500/15 p-5 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/10">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em] mb-2">20% Ahorro</p>
              <p className="text-[28px] font-bold tabular-nums text-blue-500 leading-none">{mesIngresos > 0 ? <AnimatedValue value={Math.round(mesIngresos * 0.2)} /> : "--€"}</p>
              <p className="text-xs text-muted-foreground mt-2">{mesIngresos > 0 ? "20% de tus ingresos" : "Añade ingresos para calcular"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
