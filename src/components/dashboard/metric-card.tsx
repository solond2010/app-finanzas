import React, { memo } from "react"
import { TrendingDown, TrendingUp } from "lucide-react"

export type MetricTone = "emerald" | "red" | "blue" | "amber" | "violet"

interface MetricCardProps {
  label: string
  value: React.ReactNode
  subtitle: string
  icon: React.ElementType
  tone: MetricTone
  delta?: number
  deltaGoodWhenUp?: boolean
  delay?: number
}

const ICON_TONES: Record<MetricTone, string> = {
  emerald: "bg-emerald-500/10 text-emerald-500",
  red: "bg-red-500/10 text-red-500",
  blue: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-500",
  violet: "bg-violet-500/10 text-violet-500",
}

export const MetricCard = memo(function MetricCard({
  label, value, subtitle, icon: Icon, tone, delta, deltaGoodWhenUp = true, delay = 0,
}: MetricCardProps) {
  const hasDelta = delta !== undefined && Number.isFinite(delta)
  const up = (delta ?? 0) >= 0
  const good = up === deltaGoodWhenUp

  return (
    <div
      className="stagger-fade min-w-0 rounded-[20px] border border-border bg-card p-4 transition-colors hover:border-foreground/15 sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${ICON_TONES[tone]}`}>
          <Icon className="h-4 w-4" />
        </span>
        {hasDelta && (
          <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${good ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500"}`}>
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(Math.round(delta as number))}%
          </span>
        )}
      </div>
      <p className="mt-4 truncate text-[26px] font-bold leading-none tracking-tight tabular-nums text-foreground">{value}</p>
      <p className="mt-2 truncate text-sm font-medium text-foreground/80">{label}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
})
