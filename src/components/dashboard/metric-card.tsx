import React, { memo } from "react"

export type MetricTone = "emerald" | "red" | "blue" | "amber" | "violet"

interface MetricCardProps {
  label: string
  value: React.ReactNode
  subtitle: string
  icon: React.ElementType
  tone: MetricTone
  delay?: number
}

const TONES: Record<MetricTone, string> = {
  emerald: "from-emerald-500/12 to-emerald-500/[0.02] text-emerald-500 ring-emerald-500/15",
  red: "from-red-500/12 to-red-500/[0.02] text-red-500 ring-red-500/15",
  blue: "from-blue-500/12 to-blue-500/[0.02] text-blue-500 ring-blue-500/15",
  amber: "from-amber-500/12 to-amber-500/[0.02] text-amber-500 ring-amber-500/15",
  violet: "from-violet-500/12 to-violet-500/[0.02] text-violet-500 ring-violet-500/15",
}

export const MetricCard = memo(function MetricCard({
  label, value, subtitle, icon: Icon, tone, delay = 0,
}: MetricCardProps) {
  return (
    <div
      className="stagger-fade glass-card card-glow glass-card-hover relative min-w-0 overflow-hidden rounded-[24px] p-4 sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute inset-0 rounded-[24px] bg-gradient-to-br ${TONES[tone]} opacity-75`} />
      <div className="relative z-10 space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <p className="page-section-label truncate">{label}</p>
          <div className={`shrink-0 rounded-2xl bg-background/60 p-2 ring-1 sm:p-2.5 ${TONES[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <div>
          <p className="truncate text-[26px] font-bold leading-none tracking-tight tabular-nums text-foreground sm:text-[32px]">{value}</p>
          <p className="mt-2 truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  )
})
