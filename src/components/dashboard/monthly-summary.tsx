"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart } from "@tremor/react"
import { useFinance } from "@/lib/store"
import { getMonthTotalsByString, getNetWorthAtMonth, buildMonthlySummariesUpTo, getGastosBudgetProgress } from "@/lib/calculations"
import { TrendingUp, TrendingDown, Wallet, Target, Euro } from "lucide-react"

const dataFormatter = (value: number) => `${value.toLocaleString("es-ES")}€`

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  label: string
  value: string
  subtitle: string
  icon: React.ElementType
  color?: string
  trend?: { direction: "up" | "down"; label: string }
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/70 backdrop-blur-xl p-5 shadow-sm ring-1 ring-border/20 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.08em]">{label}</span>
        <div
          className="rounded-xl p-2 ring-1 ring-border/10"
          style={{ backgroundColor: color ? `${color}0d` : undefined }}
        >
          <Icon className="h-[18px] w-[18px]" style={{ color }} />
        </div>
      </div>
      <p className="text-[28px] font-bold tracking-tight tabular-nums leading-none" style={{ color }}>
        {value}
      </p>
      <div className="flex items-center gap-1.5 mt-2">
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${trend.direction === "up" ? "text-emerald-500" : "text-red-500"}`}>
            <TrendingUp className="h-3 w-3" />
            {trend.label}
          </span>
        )}
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  )
}

export function MonthlySummary({ selectedMonth }: { selectedMonth?: string }) {
  const { state } = useFinance()
  const activeMonth = selectedMonth ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`

  const { ingresos, gastos, neto } = useMemo(
    () => getMonthTotalsByString(state.transactions, activeMonth),
    [state.transactions, activeMonth]
  )
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, activeMonth), [state.accounts, state.transactions, activeMonth])
  const summaries = useMemo(
    () => buildMonthlySummariesUpTo(state.transactions, activeMonth),
    [state.transactions, activeMonth]
  )
  const budget = useMemo(
    () => getGastosBudgetProgress(state.accounts, state.transactions, activeMonth),
    [state.accounts, state.transactions, activeMonth]
  )

  const savingsRate = ingresos > 0 ? Math.round((neto / ingresos) * 100) : 0

  return (
    <>
      <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Patrimonio Neto"
          value={`${netWorth.toLocaleString("es-ES")}€`}
          subtitle={`${state.accounts.length} cuentas`}
          icon={Wallet}
          color="var(--foreground)"
        />
        <StatCard
          label="Ingresos del Mes"
          value={`+${ingresos.toLocaleString("es-ES")}€`}
          subtitle="Últimos 30 días"
          icon={TrendingUp}
          color="#10b981"
        />
        <StatCard
          label="Gastos del Mes"
          value={`-${gastos.toLocaleString("es-ES")}€`}
          subtitle={budget ? `${Math.round((gastos / budget.limite) * 100)}% del presupuesto` : "Últimos 30 días"}
          icon={TrendingDown}
          color="#ef4444"
        />
        <StatCard
          label="Tasa de Ahorro"
          value={`${savingsRate}%`}
          subtitle={savingsRate >= 20 ? "Objetivo 20% alcanzado" : savingsRate > 0 ? "Meta: 20%" : "Sin ingresos registrados"}
          icon={Target}
          color={savingsRate >= 20 ? "#10b981" : savingsRate > 0 ? "#f59e0b" : "#ef4444"}
        />
      </div>

      <Card className="col-span-full md:col-span-7">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Euro className="h-4 w-4 text-muted-foreground" />
            Evolución Mensual
          </CardTitle>
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
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            Resumen del Mes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          <div className="flex items-center justify-between rounded-xl bg-emerald-500/[0.04] ring-1 ring-emerald-500/10 p-3.5">
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

          <div className="flex items-center justify-between rounded-xl bg-red-500/[0.04] ring-1 ring-red-500/10 p-3.5">
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

          <div className="flex items-center justify-between rounded-xl bg-primary/[0.04] ring-1 ring-primary/10 p-3.5">
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
            <div className="rounded-xl bg-muted/30 ring-1 ring-border/20 p-3.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Presupuesto mensual</span>
                <span className={budget.progreso >= 100 ? "text-red-500 font-medium" : "text-muted-foreground"}>
                  {budget.gastado.toLocaleString("es-ES")}€ / {budget.limite.toLocaleString("es-ES")}€
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${budget.progreso >= 100 ? "bg-red-500" : "bg-red-400"}`}
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
