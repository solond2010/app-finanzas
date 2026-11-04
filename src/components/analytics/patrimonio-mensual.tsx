"use client"

import { TrendPill } from "@/components/shared/trend-pill"
import { memo, useEffect, useMemo, useState } from "react"
import { AreaChart } from "@tremor/react"
import { CalendarDays, Percent, TrendingDown, TrendingUp, Wallet, Mountains, ChartBar } from "@/components/icons"

import { MetricCard } from "@/components/dashboard/metric-card"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { EmptyState } from "@/components/shared/empty-state"
import { SignedBarChart } from "@/components/shared/signed-bar-chart"
import { Sensitive } from "@/components/shared/sensitive"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  extractMonthlyPatrimonioControl,
  getPatrimonioMensualKpis,
  type PatrimonioMensualRow,
} from "@/lib/calculations"
import {
  applyStoredSnapshotsToRows,
  loadNetWorthSnapshots,
  persistMergedNetWorthSnapshots,
  type StoredNetWorthSnapshot,
} from "@/lib/net-worth-snapshots"
import { money, signedMoney, chartFormatter, chartAxisFormatter, moneyAxisWidth, formatMonth } from "@/lib/format"
import { cn } from "@/lib/utils"

const PatrimonioTooltip = createChartTooltip(["patrimonio"], ["amber"])

function formatGrowth(pct: number | null) {
  if (pct === null || !Number.isFinite(pct)) return "—"
  const rounded = Math.round(pct * 100) / 100
  const sign = rounded > 0 ? "+" : ""
  return `${sign}${rounded.toLocaleString("es-ES", { useGrouping: "always", minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

export type MonthlyCashFlowPoint = {
  /** YYYY-MM */
  monthKey: string
  ingresos: number
  gastos: number
  neto: number
}

type DailyPoint = { date: string; patrimonio: number }

interface PatrimonioMensualSectionProps {
  dailyHistory: DailyPoint[]
  /** Cashflow por mes (YYYY-MM) para el detalle unificado. */
  cashByMonth?: Record<string, { ingresos: number; gastos: number; neto: number }>
  /** Día del mes del snapshot (por defecto 5, como en la hoja de control). */
  dayOfMonth?: number
}

type MonthlyCashFlowRow = {
  monthKey: string
  monthLabel: string
  ingresos: number
  gastos: number
  neto: number
}

function recomputeVariations(rows: PatrimonioMensualRow[]): PatrimonioMensualRow[] {
  return rows.map((row, i) => {
    if (i === 0) return { ...row, variacion: 0, crecimiento: null }
    const prev = rows[i - 1]
    const variacion = row.patrimonio - prev.patrimonio
    const crecimiento =
      prev.patrimonio !== 0 ? ((row.patrimonio - prev.patrimonio) / Math.abs(prev.patrimonio)) * 100 : null
    return { ...row, variacion, crecimiento }
  })
}

/**
 * Control / detalle mensual unificado: patrimonio (día 5) + cashflow
 * (ingresos/gastos/neto) en una sola sección. Persiste snapshots en settings
 * para que un recálculo con datos incompletos no borre el histórico.
 */
export const PatrimonioMensualSection = memo(function PatrimonioMensualSection({
  dailyHistory,
  cashByMonth = {},
  dayOfMonth = 5,
}: PatrimonioMensualSectionProps) {
  const [storedSnapshots, setStoredSnapshots] = useState<StoredNetWorthSnapshot[]>([])

  const rawRows = useMemo(
    () => extractMonthlyPatrimonioControl(dailyHistory, { dayOfMonth }),
    [dailyHistory, dayOfMonth]
  )

  // Persistir snapshots definitivos (no provisionales) y fusionar con lo guardado.
  useEffect(() => {
    let cancelled = false
    const definitive = rawRows
      .filter((r) => !r.provisional && r.patrimonio > 0)
      .map((r) => ({ date: r.date, patrimonio: r.patrimonio }))
    ;(async () => {
      try {
        if (definitive.length > 0) {
          const merged = await persistMergedNetWorthSnapshots(definitive)
          if (!cancelled) setStoredSnapshots(merged)
        } else {
          const loaded = await loadNetWorthSnapshots()
          if (!cancelled) setStoredSnapshots(loaded)
        }
      } catch {
        // sin red / settings → seguimos solo con el cálculo en vivo
      }
    })()
    return () => { cancelled = true }
  }, [rawRows])

  const rows = useMemo(() => {
    const applied = applyStoredSnapshotsToRows(rawRows, storedSnapshots)
    return recomputeVariations(applied)
  }, [rawRows, storedSnapshots])

  const kpis = useMemo(() => getPatrimonioMensualKpis(rows), [rows])

  const cashflowRows: MonthlyCashFlowRow[] = useMemo(
    () => rows.map((row) => {
      const monthKey = row.date.slice(0, 7)
      const [year, month] = monthKey.split("-").map(Number)
      const cash = cashByMonth[monthKey]
      return {
        monthKey,
        monthLabel: formatMonth(new Date(year, month - 1, 1)),
        ingresos: cash?.ingresos ?? 0,
        gastos: cash?.gastos ?? 0,
        neto: cash?.neto ?? 0,
      }
    }),
    [rows, cashByMonth]
  )

  const areaData = useMemo(
    () =>
      rows.map((r) => ({
        // Eje X corto ("sep 26"): la fecha larga DD/MM/YYYY hacía que las
        // etiquetas se montaran en el gráfico estrecho de variación neta.
        mensualidad: r.label,
        patrimonio: Math.round(r.patrimonio * 100) / 100,
      })),
    [rows]
  )

  // La primera foto no tiene anterior con la que compararse: no se pinta
  // (antes dejaba un hueco vacío al principio del gráfico).
  const barData = useMemo(
    () => rows.slice(1).map((r) => ({ label: r.label, value: Math.round(r.variacion * 100) / 100, detail: r.mensualidad })),
    [rows]
  )

  const deltaPositive = (kpis.deltaEur ?? 0) >= 0
  const vsFirstPositive = (kpis.vsPrimeroEur ?? 0) >= 0

  return (
    <section className="col-span-full grid grid-cols-12 gap-4 sm:gap-6">
      <div className="col-span-full flex flex-col gap-1 pt-2">
        <p className="page-section-label">Histórico global</p>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold tracking-tight">Patrimonio y balance mensual</h2>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Cada día {dayOfMonth} guardamos una foto de tu patrimonio (la suma de los saldos de tus cuentas) y, aparte, el balance de cada mes: lo que entra, lo que sale y lo que te queda. Es tu histórico completo: no cambia al moverte entre meses.
            {kpis.ultimo?.provisional ? " · La foto de este mes es provisional hasta el día 5." : null}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="stagger-fade col-span-full" style={{ animationDelay: "80ms" }}>
          <CardContent className="py-10">
            <EmptyState
              icon={Wallet}
              title="Sin historial de patrimonio"
              description="Cuando tengas cuentas y movimientos, aquí verás una foto de tu patrimonio cada día 5, cuánto ha cambiado y el balance de cada mes."
              bordered
              className="h-full"
            />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="col-span-full grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Última foto del patrimonio"
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
              label="Cambio desde la foto anterior"
              value={<Sensitive>{signedMoney(kpis.deltaEur)}</Sensitive>}
              subtitle={rows.length > 1 ? "Respecto a la foto del mes anterior" : "Es tu primera foto"}
              icon={deltaPositive ? TrendingUp : TrendingDown}
              tone={deltaPositive ? "emerald" : "red"}
              delay={60}
            />
            <MetricCard
              label="Cambio desde la foto anterior (%)"
              value={formatGrowth(kpis.deltaPct)}
              subtitle="Crecimiento mes a mes"
              icon={Percent}
              tone={deltaPositive ? "emerald" : "red"}
              delay={120}
            />
            <MetricCard
              label="Desde la primera foto"
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
                <Mountains className="h-4 w-4 text-amber-500" />
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
                  yAxisWidth={moneyAxisWidth(areaData.map((item) => item.patrimonio))}
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
                <ChartBar className="h-4 w-4 text-emerald-500" />
                Cambio de patrimonio (€)
              </CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 overflow-x-auto">
              {barData.length > 0 ? (
                <SignedBarChart data={barData} valueFormatter={chartFormatter} axisFormatter={chartAxisFormatter} ariaLabel="Cambio de patrimonio entre una foto mensual y la anterior" className="[&>div:nth-child(2)]:h-[200px] sm:[&>div:nth-child(2)]:h-[250px]" />
              ) : <p className="py-10 text-center text-sm text-muted-foreground">Aún solo hay una foto: el cambio aparecerá con la del mes que viene.</p>}
            </CardContent>
          </Card>

          <Card className="stagger-fade col-span-full min-w-0 overflow-hidden" style={{ animationDelay: "180ms" }}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Balance mensual</CardTitle>
              <p className="text-xs text-muted-foreground">Lo que entra, lo que sale y lo que te queda cada mes (del día 1 al último).</p>
            </CardHeader>
            <CardContent className="space-y-6 px-4 pb-4 pt-0 sm:px-6">
              <div className="space-y-2">
                <div className="space-y-2 sm:hidden">
                  {[...cashflowRows].reverse().map((row) => <MobileCashFlowCard key={row.monthKey} row={row} />)}
                </div>
                <div className="hidden overflow-x-auto sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Mes</TableHead>
                        <TableHead className="text-right">Ingresos</TableHead>
                        <TableHead className="text-right">Gastos</TableHead>
                        <TableHead className="text-right">Neto</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...cashflowRows].reverse().map((row) => {
                        const hasCash = row.ingresos > 0 || row.gastos > 0
                        return (
                          <TableRow key={row.monthKey}>
                            <TableCell className="font-medium">{row.monthLabel}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-emerald-500">{hasCash ? <Sensitive>+{money(row.ingresos)}</Sensitive> : "—"}</TableCell>
                            <TableCell className="text-right font-semibold tabular-nums text-red-500">{hasCash ? <Sensitive>{row.gastos > 0 ? "-" : ""}{money(row.gastos)}</Sensitive> : "—"}</TableCell>
                            <TableCell className={cn("text-right font-bold tabular-nums", !hasCash ? "text-muted-foreground" : row.neto >= 0 ? "text-emerald-500" : "text-red-500")}>{hasCash ? <Sensitive>{signedMoney(row.neto)}</Sensitive> : "—"}</TableCell>
                            <TableCell className="text-right">
                              {hasCash ? <TrendPill up={row.neto >= 0} good={row.neto >= 0} value={row.neto >= 0 ? "Positivo" : "Negativo"} /> : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
})

const MobileCashFlowCard = memo(function MobileCashFlowCard({ row }: { row: MonthlyCashFlowRow }) {
  const hasCash = row.ingresos > 0 || row.gastos > 0
  return (
    <div className="rounded-2xl border border-border bg-card p-3.5 ring-1 ring-border/20">
      <p className="text-xs text-muted-foreground">Balance del mes</p>
      <p className="font-semibold text-foreground">{row.monthLabel}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
        <div><p className="text-[11px] text-muted-foreground">Ingresos</p><p className={cn("text-sm font-semibold tabular-nums", hasCash ? "text-emerald-500" : "text-muted-foreground")}>{hasCash ? <Sensitive>+{money(row.ingresos)}</Sensitive> : "—"}</p></div>
        <div className="text-center"><p className="text-[11px] text-muted-foreground">Gastos</p><p className={cn("text-sm font-semibold tabular-nums", hasCash ? "text-red-500" : "text-muted-foreground")}>{hasCash ? <Sensitive>{row.gastos > 0 ? "-" : ""}{money(row.gastos)}</Sensitive> : "—"}</p></div>
        <div className="text-right"><p className="text-[11px] text-muted-foreground">Neto</p><p className={cn("text-sm font-semibold tabular-nums", !hasCash ? "text-muted-foreground" : row.neto >= 0 ? "text-emerald-500" : "text-red-500")}>{hasCash ? <Sensitive>{signedMoney(row.neto)}</Sensitive> : "—"}</p></div>
      </div>
    </div>
  )
})
