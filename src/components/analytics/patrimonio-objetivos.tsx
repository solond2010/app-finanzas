"use client"

import { ArrowRight, Check, Flag, PencilLine, TrendingUp } from "@/components/icons"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Sensitive } from "@/components/shared/sensitive"
import { GoalsEmpty } from "@/components/goals/goals-empty"
import { formatMoney } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { openGoalsEditor, useWealthGoals } from "@/lib/use-wealth-goals"
import { goalLabel, goalProgress, type GoalProgress } from "@/lib/wealth-goals"

const EUR = (amount: number) => formatMoney(amount, "EUR")
const goalAmount = (amount: number) => `${amount.toLocaleString("es-ES", { useGrouping: "always", maximumFractionDigits: 0 })} €`

function EditGoalsButton({ className }: { className?: string }) {
  return (
    <Button type="button" size="sm" variant="outline" onClick={openGoalsEditor} className={cn("gap-1.5", className)}>
      <PencilLine className="h-3.5 w-3.5" /> Editar objetivos
    </Button>
  )
}

function GoalTrail({ value, view }: { value: number; view: GoalProgress }) {
  if (view.trail.length === 0) return null
  return (
    <section aria-label="Objetivos de patrimonio" className="mt-3 space-y-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div>
          <p className="page-section-label">Objetivos</p>
          <h3 className="mt-1 text-base font-semibold tracking-tight">Tu recorrido, paso a paso</h3>
        </div>
        <p className="text-right text-xs text-muted-foreground">Cada avance suma</p>
      </div>
      <div className="relative flex gap-5 overflow-x-auto pb-2 sm:gap-3" role="list" aria-label="Camino de objetivos financieros">
        {view.trail.map((goal, index) => {
          const achieved = goal.amount <= value
          const active = !achieved && goal.id === view.next?.id
          return (
            <div key={goal.id} role="listitem" className="relative flex min-w-[132px] flex-1 items-center sm:min-w-0">
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
                  "max-w-full whitespace-nowrap text-[clamp(0.68rem,1.25vw,0.875rem)] font-semibold tabular-nums",
                  achieved && "text-emerald-500",
                  active && "text-[var(--gold)]",
                  !achieved && !active && "text-foreground"
                )}>
                  <Sensitive>{goalAmount(goal.amount)}</Sensitive>
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {goal.name ? `${goal.name} · ` : ""}{achieved ? "Conseguido" : active ? "Siguiente objetivo" : "En el camino"}
                </span>
                {active && (
                  <div className="absolute inset-x-3 bottom-0 h-0.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full bg-[var(--gold)]" style={{ width: `${view.progress}%` }} />
                  </div>
                )}
              </div>
              {index < view.trail.length - 1 && <ArrowRight aria-hidden="true" className="absolute -right-3.5 z-20 h-3 w-3 text-muted-foreground/60" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function PatrimonioObjetivos({ value }: { value: number }) {
  const safeValue = Number.isFinite(value) ? value : 0
  const { goals, loaded } = useWealthGoals()
  const view = goalProgress(goals, safeValue)
  const target = view.next

  return (
    <div>
      <Card className="relative isolate overflow-hidden border-[var(--gold)]/20 bg-gradient-to-br from-card via-card to-[var(--gold)]/[0.06]">
        <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full bg-[var(--gold)]/[0.07] blur-3xl" />
        <CardContent className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)] lg:items-center">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[var(--gold)]">
                <Flag className="h-4 w-4" />
                <p className="page-section-label !text-[var(--gold)]">Tu camino financiero</p>
              </div>
              {loaded && goals.length > 0 && <EditGoalsButton className="h-8 lg:hidden" />}
            </div>
            {!loaded ? (
              <div className="mt-4 h-24 animate-pulse rounded-xl bg-muted/40" aria-label="Cargando objetivos" />
            ) : goals.length === 0 ? (
              <div className="mt-4"><GoalsEmpty netWorth={safeValue} /></div>
            ) : (
              <>
                <div className="mt-3 flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold tracking-tight text-foreground">
                      {target ? (target.name ? `Siguiente objetivo: ${target.name}` : "Siguiente objetivo") : "¡Todos tus objetivos conseguidos!"}
                    </h2>
                    <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums text-foreground sm:text-4xl">
                      <Sensitive>{goalAmount(target ? target.amount : view.previousAmount)}</Sensitive>
                    </p>
                  </div>
                  <p className="max-w-full break-words text-sm text-muted-foreground">
                    {target ? <><Sensitive>{EUR(view.remaining)}</Sensitive> para alcanzarlo</> : "Añade otro cuando quieras"}
                  </p>
                </div>
                <div className="mt-5 space-y-2">
                  <Progress value={view.progress} aria-label={target ? `Progreso hacia el objetivo de ${goalAmount(target.amount)}` : "Todos los objetivos conseguidos"} className="h-2.5 [&_[data-slot=progress-indicator]]:bg-[var(--gold)]" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Patrimonio actual: <Sensitive>{EUR(safeValue)}</Sensitive></span>
                    <span className="shrink-0">{Math.round(view.progress)}%</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {loaded && goals.length > 0 && (
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TrendingUp className="h-4 w-4 text-[var(--accent-green)]" />
                  Los siguientes pasos
                </div>
                <EditGoalsButton className="hidden h-8 lg:inline-flex" />
              </div>
              {view.upcoming.length > 0 ? (
                <div className="mt-4 flex min-w-0 items-stretch justify-between gap-1.5 sm:gap-2">
                  {view.upcoming.map((goal, index) => (
                    <div key={goal.id} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                      <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-1.5 py-3 text-center ring-1 ring-border/30 sm:px-2">
                        <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{goalLabel(goal, index)}</p>
                        <p className="mt-1 whitespace-nowrap text-[clamp(0.62rem,1vw,0.8rem)] font-semibold tabular-nums text-foreground"><Sensitive>{goalAmount(goal.amount)}</Sensitive></p>
                      </div>
                      {index < view.upcoming.length - 1 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">Has llegado a todos. Ponte uno nuevo para seguir avanzando.</p>
              )}
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Tus objetivos, de menor a mayor. Cámbialos cuando quieras.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      {loaded && <GoalTrail value={safeValue} view={view} />}
    </div>
  )
}
