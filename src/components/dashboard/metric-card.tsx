import React, { memo } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"
import { formatCappedPct } from "@/lib/format"

type MetricTone = "emerald" | "red" | "blue" | "amber" | "violet"

interface MetricCardProps {
  label: string
  value: React.ReactNode
  subtitle: React.ReactNode
  icon: React.ElementType
  tone: MetricTone
  delta?: number
  deltaGoodWhenUp?: boolean
  delay?: number
}

const ICON_TONES: Record<MetricTone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  blue: "bg-[color-mix(in_oklch,var(--gold),transparent_88%)] text-[var(--gold)]",
  amber: "bg-[color-mix(in_oklch,var(--gold),transparent_88%)] text-[var(--gold)]",
  violet: "bg-[color-mix(in_oklch,var(--gold),transparent_88%)] text-[var(--gold)]",
}

export const MetricCard = memo(function MetricCard({
  label, value, subtitle, icon: Icon, tone, delta, deltaGoodWhenUp = true, delay = 0,
}: MetricCardProps) {
  const hasDelta = delta !== undefined && Number.isFinite(delta)
  const up = (delta ?? 0) >= 0
  const good = up === deltaGoodWhenUp
  const deltaLabel = formatCappedPct(delta ?? 0).replace(/^[+-]/, "")

  return (
    <div
      data-tone={tone}
      className="metric-card stagger-fade min-w-0 rounded-[14px] border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_6px_18px_-10px_rgba(0,0,0,0.08)] transition-colors hover:border-foreground/15 sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] ring-1 ring-inset ring-current/10 ${ICON_TONES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${good ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {deltaLabel}
          </span>
        )}
      </div>
      <p className="mt-4 truncate text-[clamp(1.15rem,6vw,1.625rem)] font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-[26px]">{value}</p>
      <p className="mt-2 truncate text-sm font-medium text-foreground/80">{label}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
})
