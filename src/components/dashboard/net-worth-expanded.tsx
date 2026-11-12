"use client"

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Flag, Flame, Target, TrendingDown, TrendingUp, XIcon } from "@/components/icons"
import { Sensitive } from "@/components/shared/sensitive"
import { NetWorthChart } from "@/components/dashboard/net-worth-chart"
import { longDate, type MonthBar, type SeriesPoint } from "@/lib/net-worth-chart"
import { cn } from "@/lib/utils"
import type { AppIcon } from "@/components/icons"

/** Vista ampliada de «Evolución del patrimonio»: modal grande en escritorio y
 * hoja inferior casi a pantalla completa en el móvil (DialogContent ya hace
 * ese cambio por debajo de sm). */
export function NetWorthExpanded({
  open,
  onOpenChange,
  points,
  monthly,
  bars,
  ranges,
  rangeId,
  onRange,
  netWorth,
  peak,
  privacy,
  formatValue,
  formatAxis,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  points: SeriesPoint[]
  monthly: boolean
  bars: MonthBar[]
  ranges: { id: string }[]
  rangeId: string
  onRange: (id: string) => void
  netWorth: number
  peak: { value: number; label: string } | null
  privacy: boolean
  formatValue: (v: number) => string
  formatAxis: (v: number) => string
}) {
  const first = points[0]
  const last = points.at(-1)
  const change = first ? netWorth - first.value : 0
  const pct = first && Math.abs(first.value) >= 100 ? (change / Math.abs(first.value)) * 100 : null
  const up = change >= 0
  const dated = !!first && /^\d{4}-\d{2}-\d{2}$/.test(first.date)
  const fromLabel = first ? (dated ? longDate(first.date) : first.label) : ""
  const pctText = pct !== null && Math.abs(pct) < 1000 ? `${up ? "+" : "−"}${Math.abs(pct).toLocaleString("es-ES", { maximumFractionDigits: 1 })} %` : null

  const tiles: { icon: AppIcon; label: string; value: string; sub: string; tone?: "up" | "down" }[] = [
    { icon: Flag, label: "Inicio", value: first ? formatAxis(first.value) : "—", sub: fromLabel },
    { icon: Target, label: "Hoy", value: formatAxis(netWorth), sub: last && dated ? longDate(last.date) : "Ahora" },
    { icon: up ? TrendingUp : TrendingDown, label: "Cambio", value: `${up ? "+" : "−"}${formatAxis(Math.abs(change))}`, sub: pctText ?? "en el periodo", tone: up ? "up" : "down" },
    { icon: Flame, label: "Pico", value: peak ? formatAxis(peak.value) : "—", sub: peak?.label ?? "" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 border border-primary/25 bg-[linear-gradient(180deg,var(--hero-bg),var(--popover))] p-5 sm:max-w-[min(1040px,calc(100%-3rem))] sm:p-7 max-sm:max-h-[calc(100svh-1.5rem-env(safe-area-inset-top))] max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div aria-hidden className="mx-auto -mt-1 mb-3 h-1.5 w-10 rounded-full bg-foreground/15 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="page-section-label">Evolución del patrimonio</DialogTitle>
            <p className="hero-figure mt-1.5 text-[clamp(2rem,8vw,2.6rem)] font-bold tracking-tight tabular-nums"><Sensitive>{formatValue(netWorth)}</Sensitive></p>
            <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {first && (
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums", up ? "bg-emerald-500/12 text-emerald-500" : "bg-red-500/12 text-red-500")}>
                  {up ? <TrendingUp className="size-3.5" weight="bold" /> : <TrendingDown className="size-3.5" weight="bold" />}
                  <Sensitive>{up ? "+" : "−"}{formatValue(Math.abs(change))}{pctText ? ` (${pctText})` : ""}</Sensitive>
                </span>
              )}
              {first && <span>desde el {fromLabel.replace(/ \d{4}$/, "")}</span>}
            </DialogDescription>
          </div>
          <button type="button" onClick={() => onOpenChange(false)} aria-label="Cerrar" className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-foreground/[0.04] text-foreground transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="range-tabs mt-4 w-full justify-between sm:w-auto sm:justify-start sm:self-start">
          {ranges.map((r) => (
            <button key={r.id} type="button" onClick={() => onRange(r.id)} data-active={rangeId === r.id} className="range-tab tabular-nums">{r.id}</button>
          ))}
        </div>

        {points.length > 1 ? (
          <NetWorthChart
            points={points}
            size="large"
            monthly={monthly}
            bars={bars}
            formatValue={formatValue}
            formatAxis={formatAxis}
            hideValues={privacy}
            className="mt-4 h-[300px] w-full sm:h-[380px]"
          />
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Sin datos suficientes en este periodo.</p>
        )}
        {bars.length > 0 && points.length > 1 && (
          <p className="mt-1 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[var(--gold)]" />Patrimonio a fin de mes</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm bg-[#2BD9A0]" /><span className="size-2 rounded-sm bg-[#FF6B5B]" />Cambio de cada mes</span>
          </p>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="min-w-0 rounded-2xl border border-border/70 bg-foreground/[0.03] px-3.5 py-3">
              <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"><t.icon className="size-3.5" />{t.label}</p>
              <p className={cn("mt-1 truncate font-heading text-lg font-bold tabular-nums", t.tone === "up" && "text-emerald-500", t.tone === "down" && "text-red-500")}><Sensitive>{t.value}</Sensitive></p>
              <p className="truncate text-[11px] text-muted-foreground">{t.sub}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
