"use client"

import { memo, useMemo } from "react"
import { AreaChart, BarChart } from "@tremor/react"
import { CalendarDays, Percent, TrendingDown, TrendingUp, Wallet } from "lucide-react"

import { MetricCard } from "@/components/dashboard/metric-card"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { EmptyState } from "@/components/shared/empty-state"
import { Sensitive } from "@/components/shared/sensitive"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  extractMonthlyPatrimonioControl,
  getPatrimonioMensualKpis,
  type PatrimonioMensualRow,
} from "@/lib/calculations"
import { money, signedMoney, chartFormatter } from "@/lib/format"
import { cn } from "@/lib/utils"

const PatrimonioTooltip = createChartTooltip(["patrimonio"], ["amber"])
const VariacionTooltip = createChartTooltip(["Δ positiva", "Δ negativa"], ["emerald", "red"])

function formatGrowth(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return "—"
  const rounded = Math.round(pct * 100) / 100
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

type DailyPoint = { date: string; patrimonio: number }

interface PatrimonioMensualSectionProps {
  dailyHistory: DailyPoint[]
  /** Día del mes del snapshot (por defecto 5, como en la hoja de control). */
  dayOfMonth?: number
}

/**
 * Control Patrimonio Mensual — sección de Analytics inspirada en el Google
 * Sheet homónimo. Fuente: historial diario preciso (cuentas + inversiones)
 * muestreado el día 5 de cada mes. No persiste snapshots propios.
 */
export const PatrimonioMensualSection = memo(function PatrimonioMensualSection({
  dailyHistory,
  dayOfMonth = 5,
}: PatrimonioMensualSectionProps) {
  const rows = useMemo(
    () => extractMonthlyPatrimonioControl(dailyHistory, { dayOfMonth }),
    [dailyHistory, dayOfMonth]
  )
  const kpis = useMemo(() => getPatrimonioMensualKpis(rows), [rows])

  const areaData = useMemo(
    () =>
      rows.map((r) => ({
        mensualidad: r.mensualidad,
        patrimonio: Math.round(r.patrimonio * 100) / 100,
      })),
    [rows]
  )

  const barData = useMemo(
    () =>
      rows.map((r) => ({
        mensualidad: r.mensualidad,
        "Δ positiva": r.variacion > 0 ? Math.round(r.variacion * 100) / 100 : 0,
        "Δ negativa": r.variacion < 0 ? Math.round(Math.abs(r.variacion) * 100) / 100 : 0,
      })),
    [rows]
  )

  const deltaPositive = (kpis.deltaEur ?? 0) >= 0
  const vsFirstPositive = (kpis.vsPrimeroEur ?? 0) >= 0

  return (
    <section className="col-span-full grid grid-cols-12 gap-4 sm:gap-6">
      <div className="col-span-full flex flex-col gap-1 pt-2">
        <p className="page-section-label">Patrimonio</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-xl font-bold tracking-tight">Control patrimonio mensual</h2>
          <p className="max-w-xl text-sm text-muted-foreground">
            Snapshot el día {dayOfMonth} de cada mes · cuentas + valor de mercado de inversiones.
            {kpis.ultimo?.provisional ? " · Mes en curso provisional (aún no llegó el día 5)." : null}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="stagger-fade col-span-full" style={{ animationDelay: "80ms" }}>
          <CardContent className="py-10">
            <EmptyState
              icon={Wallet}
              title="Sin historial de patrimonio"
              description="Cuando tengas cuentas y movimientos, aquí verás el patrimonio de cada mensualidad (día 5), la variación neta y el crecimiento."
              bordered
              className="h-full"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Patrimonio actual"
              value={<Sensitive>{money(kpis.actual)}</Sensitive>}
              subtitle={
                kpis.ultimo
                  ? `${kpis.ultimo.provisional ? "Provisional · " : ""}${kpis.ultimo.mensualidad}`
                  : "—"
              }
              icon={Wallet}
              tone="blue"
              delay={0}
            />
            <MetricCard
              label="Δ€ vs mes anterior"
              value={<Sensitive>{signedMoney(kpis.deltaEur)}</Sensitive>}
              subtitle={rows.length > 1 ? "Respecto a la mensualidad previa" : "Primer snapshot"}
              icon={deltaPositive ? TrendingUp : TrendingDown}
              tone={deltaPositive ? "emerald" : "red"}
              delay={60}
            />
            <MetricCard
              label="Δ% vs mes anterior"
              value={formatGrowth(kpis.deltaPct)}
              subtitle="Crecimiento mes a mes"
              icon={Percent}
              tone={deltaPositive ? "emerald" : "red"}
              delay={120}
            />
            <MetricCard
              label="Vs primer snapshot"
              value={<Sensitive>{signedMoney(kpis.vsPrimeroEur)}</Sensitive>}
              subtitle={
                kpis.primero
                  ? `${formatGrowth(kpis.vsPrimeroPct)} desde ${kpis.primero.mensualidad}`
                  : "—"
              }
              icon={CalendarDays}
              tone={vsFirstPositive ? "emerald" : "amber"}
              delay={180}
            />
          </div>

          <Card className="stagger-fade col-span-full xl:col-span-7 min-w-0 overflow-hidden" style={{ animationDelay: "100ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="h-4 w-4 text-amber-500" />
                Patrimonio por mensualidad
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 overflow-x-auto">
              <div role="img" aria-label="Gráfico de área: patrimonio total por mensualidad" className="min-w-0">
                <AreaChart
                  data={areaData}
                  index="mensualidad"
                  categories={["patrimonio"]}
                  colors={["amber"]}
                  valueFormatter={chartFormatter}
                  yAxisWidth={56}
                  customTooltip={PatrimonioTooltip}
                  className="h-[220px] sm:h-[280px]"
                  showAnimation
                  showLegend={false}
                  curveType="monotone"
                  showGridLines={false}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="stagger-fade col-span-full xl:col-span-5 min-w-0 overflow-hidden" style={{ animationDelay: "140ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Variación neta (€)
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 overflow-x-auto">
              <div role="img" aria-label="Gráfico de barras: variación neta en euros por mensualidad" className="min-w-0">
                <BarChart
                  data={barData}
                  index="mensualidad"
                  categories={["Δ positiva", "Δ negativa"]}
                  colors={["emerald", "red"]}
                  valueFormatter={chartFormatter}
                  yAxisWidth={56}
                  customTooltip={VariacionTooltip}
                  className="h-[220px] sm:h-[280px]"
                  showAnimation
                  showLegend={false}
                  stack
                />
              </div>
            </CardContent>
          </Card>

          <Card className="stagger-fade col-span-full min-w-0 overflow-hidden" style={{ animationDelay: "180ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Detalle mensual</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Móvil: cards apilables; desktop: tabla limpia */}
              <div className="space-y-2 p-3 sm:hidden">
                {[...rows].reverse().map((row) => (
                  <MobilePatrimonioCard key={row.date} row={row} />
                ))}
              </div>
              <div className="hidden overflow-x-auto sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mensualidad</TableHead>
                      <TableHead className="text-right">Patrimonio</TableHead>
                      <TableHead className="text-right">Variación €</TableHead>
                      <TableHead className="text-right">Crecimiento %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...rows].reverse().map((row, idx) => {
                      const isFirst = idx === rows.length - 1
                      return (
                        <TableRow key={row.date}>
                          <TableCell className="font-medium tabular-nums">
                            <span className="inline-flex items-center gap-2">
                              {row.mensualidad}
                              {row.provisional && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                                  Provisional
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            <Sensitive>{money(row.patrimonio)}</Sensitive>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              isFirst
                                ? "text-muted-foreground"
                                : row.variacion >= 0
                                  ? "text-emerald-500"
                                  : "text-red-500"
                            )}
                          >
                            {isFirst ? "—" : <Sensitive>{signedMoney(row.variacion)}</Sensitive>}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              row.crecimiento === null
                                ? "text-muted-foreground"
                                : row.crecimiento >= 0
                                  ? "text-emerald-500"
                                  : "text-red-500"
                            )}
                          >
                            {formatGrowth(row.crecimiento)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
})

const MobilePatrimonioCard = memo(function MobilePatrimonioCard({ row }: { row: PatrimonioMensualRow }) {
  const hasPrev = row.crecimiento !== null
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 ring-1 ring-border/20">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Mensualidad</p>
          <p className="font-semibold tabular-nums text-foreground">
            {row.mensualidad}
            {row.provisional && (
              <span className="ml-2 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                Provisional
              </span>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Patrimonio</p>
          <p className="text-base font-bold tabular-nums">
            <Sensitive>{money(row.patrimonio)}</Sensitive>
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
        <div>
          <p className="text-[11px] text-muted-foreground">Variación €</p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              !hasPrev ? "text-muted-foreground" : row.variacion >= 0 ? "text-emerald-500" : "text-red-500"
            )}
          >
            {hasPrev ? <Sensitive>{signedMoney(row.variacion)}</Sensitive> : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">Crecimiento %</p>
          <p
            className={cn(
              "text-sm font-semibold tabular-nums",
              row.crecimiento === null
                ? "text-muted-foreground"
                : row.crecimiento >= 0
                  ? "text-emerald-500"
                  : "text-red-500"
            )}
          >
            {formatGrowth(row.crecimiento)}
          </p>
        </div>
      </div>
    </div>
  )
})
