"use client"

import { ArrowRight, Check, Flag, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Sensitive } from "@/components/shared/sensitive"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"

const EUR = (amount: number) => formatMoney(amount, "EUR")
const milestoneLabel = (amount: number) => `${amount.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`

function stepFor(value: number) {
  if (value < 25_000) return 2_500
  if (value < 100_000) return 5_000
  if (value < 250_000) return 10_000
  if (value < 500_000) return 25_000
  if (value < 1_000_000) return 50_000
  return 100_000
}

function upcomingMilestones(value: number, count: number) {
  const result: number[] = []
  let cursor = Math.max(value, 0)
  for (let i = 0; i < count; i++) {
    const step = stepFor(cursor)
    const target = (Math.floor(cursor / step) + 1) * step
    result.push(target)
    cursor = target
  }
  return result
}

function milestoneTrail(value: number, count: number) {
  const safeValue = Math.max(Number.isFinite(value) ? value : 0, 0)
  const step = stepFor(safeValue)
  let cursor = Math.max(step, Math.floor(safeValue / step) * step)
  return Array.from({ length: count }, () => {
    const milestone = cursor
    cursor += stepFor(cursor)
    return milestone
  })
}

function MilestoneTrail({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? value : 0
  const next = upcomingMilestones(safeValue, 1)[0]
  const milestones = milestoneTrail(safeValue, 5)

  return (
    <section aria-label="Hitos de patrimonio" className="mt-3 space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="page-section-label">Hitos</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Tu recorrido, paso a paso</h3>
        </div>
        <p className="text-right text-xs text-muted-foreground">Cada avance suma</p>
      </div>
      <div className="relative flex gap-5 overflow-x-auto pb-2 sm:gap-3" role="list" aria-label="Camino de hitos financieros">
        {milestones.map((milestone, index) => {
          const achieved = milestone <= safeValue
          const active = !achieved && milestone === next
          return (
            <div key={milestone} role="listitem" className="relative flex min-w-[132px] flex-1 items-center sm:min-w-0">
              <div className={cn(
                "relative z-10 flex min-h-[84px] w-full flex-col justify-center gap-1.5 rounded-2xl border px-3 py-3 transition-colors",
                achieved && "border-emerald-500/30 bg-emerald-500/[0.07]",
                active && "border-[var(--gold)]/50 bg-[var(--gold)]/[0.08]",
                !achieved && !active && "border-border/70 bg-card/70"
              )}>
                <span className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  achieved && "bg-emerald-500/15 text-emerald-500",
                  active && "bg-[var(--gold)]/20 text-[var(--gold)]",
                  !achieved && !active && "bg-muted text-muted-foreground"
                )}>
                  {achieved ? <Check className="h-3 w-3" /> : String(index + 1).padStart(2, "0")}
                </span>
                <span className={cn(
                  "whitespace-nowrap text-sm font-semibold tabular-nums",
                  achieved && "text-emerald-500",
                  active && "text-[var(--gold)]",
                  !achieved && !active && "text-foreground"
                )}>
                  <Sensitive>{milestoneLabel(milestone)}</Sensitive>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {achieved ? "Conseguido" : active ? "Siguiente hito" : "En el camino"}
                </span>
                {active && (
                  <div className="absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-[var(--gold)]" style={{ width: `${Math.max(0, Math.min(((safeValue - (milestone - stepFor(safeValue))) / stepFor(safeValue)) * 100, 100))}%` }} />
                  </div>
                )}
              </div>
              {index < milestones.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-3.5 z-20 h-3 w-3 text-muted-foreground/60" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function PatrimonioHitos({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? value : 0
  const [target, next, afterNext] = upcomingMilestones(safeValue, 3)
  const previous = Math.max(target - stepFor(Math.max(safeValue, 0)), 0)
  const range = target - previous
  const progress = range > 0 ? Math.min(Math.max(((safeValue - previous) / range) * 100, 0), 100) : 0
  const remaining = Math.max(target - safeValue, 0)

  return (
    <div>
      <Card className="relative isolate overflow-hidden border-[var(--gold)]/20 bg-gradient-to-br from-card via-card to-[var(--gold)]/[0.06]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[var(--gold)]/[0.07] blur-3xl" />
        <CardContent className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] lg:items-center">
          <div>
          <div className="flex items-center gap-2 text-[var(--gold)]">
            <Flag className="h-4 w-4" />
            <p className="page-section-label !text-[var(--gold)]">Tu camino financiero</p>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Siguiente hito</h2>
              <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                <Sensitive>{EUR(target)}</Sensitive>
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              <Sensitive>{EUR(remaining)}</Sensitive> para alcanzarlo
            </p>
          </div>
          <div className="mt-5 space-y-2">
            <Progress value={progress} aria-label={`Progreso hacia el hito de ${EUR(target)}`} className="h-2.5 [&_[data-slot=progress-indicator]]:bg-[var(--gold)]" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Patrimonio actual: <Sensitive>{EUR(safeValue)}</Sensitive></span>
              <span>{Math.round(progress)} %</span>
            </div>
          </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <TrendingUp className="h-4 w-4 text-[var(--accent-green)]" />
            Los siguientes pasos
          </div>
          <div className="mt-4 flex items-center justify-between gap-2">
            {[target, next, afterNext].map((milestone, index) => (
              <div key={milestone} className="flex min-w-0 flex-1 items-center gap-2">
                <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-2 py-3 text-center ring-1 ring-border/30">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{index === 0 ? "Ahora" : `Hito ${index + 1}`}</p>
                  <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground"><Sensitive>{EUR(milestone)}</Sensitive></p>
                </div>
                {index < 2 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Empieza con pasos de 2.500 € y aumenta el intervalo poco a poco al crecer tu patrimonio.
          </p>
          </div>
        </CardContent>
      </Card>
      <MilestoneTrail value={safeValue} />
    </div>
  )
}
