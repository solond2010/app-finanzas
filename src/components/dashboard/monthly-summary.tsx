"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart } from "@tremor/react"
import { useFinance } from "@/lib/store"
import { getCurrentMonthTotals, getMonthTotalsByString, getNetWorth, buildMonthlySummaries, getGastosBudgetProgress } from "@/lib/calculations"
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react"

const dataFormatter = (value: number) => `${value.toLocaleString("es-ES")}€`

export function MonthlySummary({ selectedMonth }: { selectedMonth?: string }) {
  const { state } = useFinance()

  const { ingresos, gastos, neto } = useMemo(
    () => selectedMonth ? getMonthTotalsByString(state.transactions, selectedMonth) : getCurrentMonthTotals(state.transactions),
    [state.transactions, selectedMonth]
  )
  const netWorth = useMemo(() => getNetWorth(state.accounts), [state.accounts])
  const summaries = useMemo(
    () => buildMonthlySummaries(state.transactions),
    [state.transactions]
  )
  const budget = useMemo(
    () => getGastosBudgetProgress(state.accounts, state.transactions),
    [state.accounts, state.transactions]
  )

  const savingsRate = ingresos > 0 ? Math.round((neto / ingresos) * 100) : 0

  return (
    <>
      <div className="col-span-full grid grid-cols-4 gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Wallet className="h-3.5 w-3.5" />
            Patrimonio Neto
          </div>
          <p className="text-2xl font-bold tabular-nums">{netWorth.toLocaleString("es-ES")}€</p>
          <p className="text-xs text-muted-foreground mt-1">{state.accounts.length} cuentas</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            Ingresos del mes
          </div>
          <p className="text-2xl font-bold tabular-nums text-emerald-500">+{ingresos.toLocaleString("es-ES")}€</p>
          <p className="text-xs text-muted-foreground mt-1">Últimos 30 días</p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <TrendingDown className="h-3.5 w-3.5 text-red-500" />
            Gastos del mes
          </div>
          <p className="text-2xl font-bold tabular-nums text-red-500">-{gastos.toLocaleString("es-ES")}€</p>
          <p className="text-xs text-muted-foreground mt-1">
            {budget
              ? `${Math.round((gastos / budget.limite) * 100)}% del presupuesto`
              : "Últimos 30 días"}
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Target className="h-3.5 w-3.5" />
            Tasa de ahorro
          </div>
          <p className={`text-2xl font-bold tabular-nums ${savingsRate >= 20 ? "text-emerald-500" : savingsRate > 0 ? "text-amber-500" : "text-red-500"}`}>
            {savingsRate}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {savingsRate >= 20 ? "Objetivo 20% alcanzado" : savingsRate > 0 ? "Meta: 20%" : "Sin ingresos registrados"}
          </p>
        </div>
      </div>

      <Card className="col-span-full md:col-span-7">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Evolución Mensual</CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.every((s) => s.ingresos === 0 && s.gastos === 0) ? (
            <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">
              Añade transacciones para ver el gráfico
            </div>
          ) : (
            <LineChart
              data={summaries}
              index="mes"
              categories={["ingresos", "gastos"]}
              colors={["emerald", "red"]}
              valueFormatter={dataFormatter}
              yAxisWidth={70}
              className="h-48"
              showAnimation
            />
          )}
        </CardContent>
      </Card>

      <Card className="col-span-full md:col-span-5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resumen del Mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-emerald-500/10 p-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ingresos</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-500">
                  +{ingresos.toLocaleString("es-ES")}€
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gastos</p>
                <p className="text-sm font-semibold tabular-nums text-red-500">
                  -{gastos.toLocaleString("es-ES")}€
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Neto del mes</p>
                <p className={`text-sm font-semibold tabular-nums ${neto >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {neto >= 0 ? "+" : ""}{neto.toLocaleString("es-ES")}€
                </p>
              </div>
            </div>
          </div>

          {budget && (
            <div className="rounded-lg border p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Presupuesto mensual</span>
                <span className={budget.progreso >= 100 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                  {budget.gastado.toLocaleString("es-ES")}€ / {budget.limite.toLocaleString("es-ES")}€
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${budget.progreso >= 100 ? "bg-red-500" : "bg-red-400"}`}
                  style={{ width: `${budget.progreso}%` }}
                />
              </div>
              <p className={`text-[11px] ${budget.restante >= 0 ? "text-muted-foreground" : "text-red-500 font-medium"}`}>
                {budget.restante >= 0
                  ? `Te quedan ${budget.restante.toLocaleString("es-ES")}€`
                  : `Te has pasado por ${Math.abs(budget.restante).toLocaleString("es-ES")}€`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
