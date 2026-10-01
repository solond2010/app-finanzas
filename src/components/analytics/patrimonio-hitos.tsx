"use client"

import { ArrowRight, Flag, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Sensitive } from "@/components/shared/sensitive"
import { formatMoney } from "@/lib/currency"

const EUR = (amount: number) => formatMoney(amount, "EUR")

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

export function PatrimonioHitos({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? value : 0
  const [target, next, afterNext] = upcomingMilestones(safeValue, 3)
  const previous = Math.max(target - stepFor(Math.max(safeValue, 0)), 0)
  const range = target - previous
  const progress = range > 0 ? Math.min(Math.max(((safeValue - previous) / range) * 100, 0), 100) : 0
  const remaining = Math.max(target - safeValue, 0)

  return (
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
  )
}
