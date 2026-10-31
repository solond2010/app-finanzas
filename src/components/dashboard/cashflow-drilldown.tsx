"use client"

import Link from "next/link"
import { useMemo } from "react"
import type { CustomTooltipProps } from "@tremor/react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CategoryIcon } from "@/components/icons/category-icon"
import { ChevronRight } from "@/components/icons"
import { ChangePill, trendPct } from "@/components/shared/trend-pill"
import { Sensitive } from "@/components/shared/sensitive"
import { SHEET_CONTENT, SheetHandle } from "@/components/dashboard/sheet-handle"
import { formatMoney } from "@/lib/currency"
import { reportingAmount, type CurrencyByAccount } from "@/lib/calculations"
import { parseLocalDate } from "@/lib/date-utils"
import type { Transaction } from "@/lib/store"
import { cn } from "@/lib/utils"

export type CashflowBucket = {
  key: string
  label: string
  Ingresos: number
  Gastos: number
  "Ahorro neto": number
  /** Totales del tramo anterior (mes o semana previa) para comparar. */
  prev: { label: string; ingresos: number; gastos: number } | null
}

// Ingresos en verde y gastos en rojo (como «Cambio de patrimonio» y Movimientos);
// el ahorro neto en el dorado de marca para no confundirse con los ingresos.
export const CASHFLOW_COLORS = { ingresos: "var(--accent-green)", gastos: "var(--accent-red)", ahorro: "var(--gold)" }

const MONTH_NAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

/** «Octubre 2026» para un tramo mensual; la etiqueta tal cual para semanas. */
export function bucketTitle(bucket: CashflowBucket, granularity: "week" | "month") {
  if (granularity !== "month" || !/^\d{4}-\d{2}$/.test(bucket.key)) return `Semana ${bucket.label}`
  const [year, month] = bucket.key.split("-").map(Number)
  const name = MONTH_NAMES[month - 1]
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${year}`
}

/** «septiembre» (con año si cambia) o «semana anterior». */
export function previousLabel(bucket: CashflowBucket, granularity: "week" | "month") {
  if (granularity !== "month" || !/^\d{4}-\d{2}$/.test(bucket.key)) return "semana anterior"
  const [year, month] = bucket.key.split("-").map(Number)
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return prevYear === year ? MONTH_NAMES[prevMonth - 1] : `${MONTH_NAMES[prevMonth - 1]} ${prevYear}`
}

function Comparison({ bucket, size }: { bucket: CashflowBucket; size?: "xs" | "sm" }) {
  if (!bucket.prev) return null
  return (
    <>
      <ChangePill label="Gastos" current={bucket.Gastos} previous={bucket.prev.gastos} lowerIsBetter size={size} />
      <ChangePill label="Ingresos" current={bucket.Ingresos} previous={bucket.prev.ingresos} size={size} />
      <ChangePill label="Ahorro" current={bucket.Ingresos - bucket.Gastos} previous={bucket.prev.ingresos - bucket.prev.gastos} size={size} />
    </>
  )
}

/** Tooltip de escritorio de «Ingresos vs gastos»: resumen completo del tramo. */
export function CashflowHoverTooltip({ active, payload, granularity = "month" }: CustomTooltipProps & { granularity?: "week" | "month" }) {
  if (!active || !payload || payload.length === 0) return null
  const bucket = payload[0]?.payload as CashflowBucket | undefined
  if (!bucket) return null
  const neto = bucket.Ingresos - bucket.Gastos
  return (
    <div className="min-w-[190px] rounded-xl border border-border bg-popover p-3 shadow-lg">
      <p className="mb-2 text-[11px] font-semibold text-foreground">{bucketTitle(bucket, granularity)}</p>
      <div className="space-y-1.5 text-xs">
        {([
          ["Ingresos", bucket.Ingresos, CASHFLOW_COLORS.ingresos],
          ["Gastos", bucket.Gastos, CASHFLOW_COLORS.gastos],
          ["Ahorro", neto, neto >= 0 ? CASHFLOW_COLORS.ahorro : "var(--accent-red)"],
        ] as const).map(([name, value, color]) => (
          <div key={name} className="flex items-center gap-2">
            <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="flex-1 text-muted-foreground">{name}</span>
            <span className="font-semibold tabular-nums text-foreground"><Sensitive>{formatMoney(value, "EUR")}</Sensitive></span>
          </div>
        ))}
      </div>
      {bucket.prev && (trendPct(bucket.Gastos, bucket.prev.gastos) !== null || trendPct(bucket.Ingresos, bucket.prev.ingresos) !== null) && (
        <div className="mt-2 flex flex-col items-start gap-1 border-t border-border pt-2 text-[11px]">
          <span className="text-muted-foreground">vs. {previousLabel(bucket, granularity)}</span>
          <Comparison bucket={bucket} size="xs" />
        </div>
      )}
      <p className="mt-2 text-[10px] font-medium text-primary">Haz clic para ver el desglose ›</p>
    </div>
  )
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"]
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`

export function CashflowDrilldown({ bucket, granularity, transactions, currencyByAccount, catColor, onClose }: {
  bucket: CashflowBucket | null
  granularity: "week" | "month"
  /** Movimientos del periodo que cuentan para el flujo (sin traspasos). */
  transactions: Transaction[]
  currencyByAccount: CurrencyByAccount
  catColor: (name: string) => string
  onClose: () => void
}) {
  const monthKey = bucket ? bucket.key.slice(0, 7) : ""
  const monthLabel = monthKey ? parseLocalDate(`${monthKey}-01`).toLocaleDateString("es-ES", { month: "long", year: "numeric" }) : ""

  const detail = useMemo(() => {
    if (!bucket) return null
    const inBucket = (t: Transaction) => {
      if (granularity === "month") return t.fecha.startsWith(bucket.key)
      const start = parseLocalDate(bucket.key)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      return t.fecha >= bucket.key && t.fecha <= dayKey(end)
    }
    const rows = transactions.filter(inBucket)
    const byCategory = (tipo: "gasto" | "ingreso") => {
      const map = new Map<string, number>()
      for (const t of rows) if (t.tipo === tipo) map.set(t.categoria, (map.get(t.categoria) ?? 0) + reportingAmount(t, currencyByAccount))
      return [...map.entries()].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto)
    }
    // Sub-tramos: semanas del mes (lunes a domingo) o días de la semana.
    const slices: { label: string; gastos: number; ingresos: number }[] = []
    if (granularity === "month") {
      const first = parseLocalDate(`${bucket.key}-01`)
      const last = new Date(first.getFullYear(), first.getMonth() + 1, 0)
      const cursor = new Date(first)
      while (cursor <= last) {
        const start = new Date(cursor)
        const end = new Date(cursor)
        end.setDate(end.getDate() + (6 - ((end.getDay() + 6) % 7)))
        if (end > last) end.setTime(last.getTime())
        const from = dayKey(start)
        const to = dayKey(end)
        const slice = { label: `${start.getDate()}–${end.getDate()}`, gastos: 0, ingresos: 0 }
        for (const t of rows) {
          if (t.fecha < from || t.fecha > to) continue
          if (t.tipo === "gasto") slice.gastos += reportingAmount(t, currencyByAccount)
          if (t.tipo === "ingreso") slice.ingresos += reportingAmount(t, currencyByAccount)
        }
        slices.push(slice)
        cursor.setTime(end.getTime())
        cursor.setDate(cursor.getDate() + 1)
      }
    } else {
      const start = parseLocalDate(bucket.key)
      for (let i = 0; i < 7; i++) {
        const date = new Date(start)
        date.setDate(date.getDate() + i)
        const key = dayKey(date)
        const slice = { label: `${WEEKDAYS[i]} ${date.getDate()}`, gastos: 0, ingresos: 0 }
        for (const t of rows) {
          if (t.fecha !== key) continue
          if (t.tipo === "gasto") slice.gastos += reportingAmount(t, currencyByAccount)
          if (t.tipo === "ingreso") slice.ingresos += reportingAmount(t, currencyByAccount)
        }
        slices.push(slice)
      }
    }
    return { gastos: byCategory("gasto"), ingresos: byCategory("ingreso"), slices, count: rows.length }
  }, [bucket, granularity, transactions, currencyByAccount])

  const neto = bucket ? bucket.Ingresos - bucket.Gastos : 0
  const maxSlice = Math.max(1, ...(detail?.slices.map((s) => s.gastos) ?? [0]))

  return (
    <Dialog open={bucket !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className={cn("sm:max-w-lg", SHEET_CONTENT)}>
        {bucket && detail && (
          <>
            <SheetHandle />
            <DialogHeader>
              <DialogTitle className="pr-8 text-lg">{bucketTitle(bucket, granularity)}</DialogTitle>
              <DialogDescription>
                {granularity === "month" ? "Desglose del mes" : "Desglose de la semana"} · {detail.count} {detail.count === 1 ? "movimiento" : "movimientos"}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2">
              {([
                ["Ingresos", bucket.Ingresos, CASHFLOW_COLORS.ingresos],
                ["Gastos", bucket.Gastos, CASHFLOW_COLORS.gastos],
                ["Ahorro", neto, neto >= 0 ? CASHFLOW_COLORS.ahorro : "var(--accent-red)"],
              ] as const).map(([name, value, color]) => (
                <div key={name} className="min-w-0 rounded-xl border border-border/70 bg-background/40 p-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />{name}</p>
                  <p className="mt-1 truncate text-sm font-bold tabular-nums sm:text-base" style={{ color: name === "Ahorro" ? color : undefined }}><Sensitive>{formatMoney(value, "EUR")}</Sensitive></p>
                </div>
              ))}
            </div>
            {bucket.prev && (
              <div className="-mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="mr-0.5 text-muted-foreground">vs. {previousLabel(bucket, granularity)}</span>
                <Comparison bucket={bucket} />
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">{granularity === "month" ? "Gasto por semana" : "Gasto por día"}</p>
              <div className="flex h-24 items-end gap-1.5" role="img" aria-label={detail.slices.map((s) => `${s.label}: ${formatMoney(s.gastos, "EUR")}`).join(", ")}>
                {detail.slices.map((slice) => (
                  <div key={slice.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="w-full truncate text-center text-[9px] tabular-nums text-muted-foreground"><Sensitive>{slice.gastos > 0 ? formatMoney(slice.gastos, "EUR").replace(/,\d{2}/, "") : ""}</Sensitive></span>
                    <span className="w-full rounded-t-md" style={{ height: `${Math.max(slice.gastos > 0 ? 6 : 2, (slice.gastos / maxSlice) * 56)}px`, backgroundColor: slice.gastos > 0 ? CASHFLOW_COLORS.gastos : "var(--border)" }} />
                    <span className="w-full truncate text-center text-[10px] text-muted-foreground">{slice.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {([ ["gasto", "Gastos por categoría", detail.gastos], ["ingreso", "Ingresos por categoría", detail.ingresos] ] as const).map(([tipo, title, items]) => items.length > 0 && (
              <div key={tipo}>
                <p className="mb-1 text-xs font-semibold text-foreground">{title}</p>
                <ul className="divide-y divide-border/70 rounded-xl border border-border/70">
                  {items.map((item) => {
                    const total = tipo === "gasto" ? bucket.Gastos : bucket.Ingresos
                    return (
                      <li key={item.categoria}>
                        <Link
                          href={`/transactions?tipo=${tipo}&categoria=${encodeURIComponent(item.categoria)}&mes=${monthKey}`}
                          onClick={onClose}
                          className="flex min-h-12 items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none"
                        >
                          <CategoryIcon name={item.categoria} color={catColor(item.categoria)} />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.categoria}</span>
                          <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                            <Sensitive className="font-semibold text-foreground">{formatMoney(item.monto, "EUR")}</Sensitive>
                            {total > 0 && <span className="ml-1.5">{Math.round((item.monto / total) * 100)}%</span>}
                          </span>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}

            <Link
              href={`/transactions?mes=${monthKey}`}
              onClick={onClose}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ver todos los movimientos de {monthLabel} <ChevronRight className="size-4" />
            </Link>
            {granularity === "week" && <p className="-mt-2 text-center text-[11px] text-muted-foreground">Movimientos filtra por mes completo.</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
