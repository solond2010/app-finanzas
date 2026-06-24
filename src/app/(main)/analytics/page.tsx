"use client"

import { useMemo, useEffect, useState } from "react"
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
import { useFinance, generateSampleData, backupCurrentState, restoreBackup, clearBackup } from "@/lib/store"
import {
  getNeedsVsWantsForMonth,
  getCategoryBreakdown,
  buildMonthlySummariesUpTo,
  buildMonthlyCashFlow,
  buildNetWorthHistory,
} from "@/lib/calculations"
import { BarChart3, PieChart, TrendingUp, Wallet, FlaskConical, ChevronLeft, ChevronRight } from "lucide-react"

const dataFormatter = (value: number) => `${value.toLocaleString("es-ES")}€`

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
  const panelClass = "border-border/60 bg-card/95 shadow-sm"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Analíticas</h1>
          <p className="text-sm text-muted-foreground">Visualización clara de tus ingresos, gastos y patrimonio.</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm backdrop-blur-sm">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[160px] text-center text-sm font-medium capitalize">{selectedDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
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
        <Card className={`col-span-full ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              Evolución del Patrimonio Neto
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Añade transacciones para ver la evolución</div>
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

        <Card className={`col-span-full md:col-span-5 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Wallet className="h-4 w-4" />
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
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      Añade transacciones para ver el cash flow
                    </TableCell>
                  </TableRow>
                ) : (
                  cashFlow.slice().reverse().map((m) => (
                    <TableRow key={m.mes}>
                      <TableCell className="font-medium text-sm">{m.mes}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-500 text-sm">+{m.ingresos.toLocaleString("es-ES")}€</TableCell>
                      <TableCell className="text-right tabular-nums text-red-500 text-sm">-{m.gastos.toLocaleString("es-ES")}€</TableCell>
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

        <Card className={`col-span-full md:col-span-7 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Ingresos vs Gastos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">Añade transacciones para ver el gráfico</div>
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

        <Card className={`col-span-full md:col-span-4 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Necesidades vs Deseos
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {!hasData ? (
              <div className="h-44 flex items-center text-sm text-muted-foreground">Sin datos este mes</div>
            ) : (
              <>
                <DonutChart data={needsWantsData} category="value" index="name" colors={["emerald", "amber"]} variant="donut" className="h-44 w-44" showAnimation />
                <Legend categories={["Necesidades", "Deseos"]} colors={["emerald", "amber"]} className="mt-3" />
                <div className="mt-3 flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    {necesidades.toLocaleString("es-ES")}€
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    {deseos.toLocaleString("es-ES")}€
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`col-span-full md:col-span-8 ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Gastos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!hasData ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Añade transacciones para ver el gráfico</div>
            ) : (
              <BarChart data={categoryBreakdown} index="categoria" categories={["monto"]} colors={["blue"]} valueFormatter={dataFormatter} yAxisWidth={60} className="h-64" showAnimation layout="vertical" />
            )}
          </CardContent>
        </Card>

        <Card className={`col-span-full ${panelClass}`}>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Regla 50/30/20</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/10">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">50% Necesidades</p>
                <p className="text-2xl font-bold tabular-nums text-emerald-500">{necesidades.toLocaleString("es-ES")}€</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {necesidades + deseos > 0 ? `${Math.round((necesidades / (necesidades + deseos)) * 100)}% del gasto` : "Sin datos"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-amber-500/10">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">30% Deseos</p>
                <p className="text-2xl font-bold tabular-nums text-amber-500">{deseos.toLocaleString("es-ES")}€</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {necesidades + deseos > 0 ? `${Math.round((deseos / (necesidades + deseos)) * 100)}% del gasto` : "Sin datos"}
                </p>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/10">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">20% Ahorro</p>
                <p className="text-2xl font-bold tabular-nums text-blue-500">--€</p>
                <p className="text-xs text-muted-foreground mt-1">Añade ingresos para calcular</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
