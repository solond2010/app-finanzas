"use client"

import { useMemo } from "react"
import { Flag, Sparkles, Target } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { PaywallPreview } from "@/components/billing/paywall-preview"
import { Sensitive } from "@/components/shared/sensitive"
import { isProAccess, usePlan } from "@/lib/billing/use-plan"
import { averageMonthlySavings, monthsLabel, monthsToGoal, projectNetWorth } from "@/lib/billing/projection"
import { formatMoney } from "@/lib/currency"
import { openGoalsEditor, useWealthGoals } from "@/lib/use-wealth-goals"
import { useFinance } from "@/lib/store"
import { cn } from "@/lib/utils"

const eur = (n: number) => formatMoney(n, "EUR")

export function ProjectionCard({ netWorth }: { netWorth: number }) {
  const plan = usePlan()
  const locked = plan.enabled && !isProAccess(plan)
  const { state } = useFinance()
  const { goals, loaded } = useWealthGoals()
  const avg = useMemo(
    () => averageMonthlySavings(state.transactions.map((t) => ({ fecha: t.fecha, monto: t.monto, tipo: t.tipo, categoria: t.categoria }))),
    [state.transactions],
  )
  const yearAhead = projectNetWorth(netWorth, avg, 12)
  const sorted = useMemo(() => [...goals].sort((a, b) => a.amount - b.amount), [goals])

  const body = (
    <section className="rounded-2xl border border-[color-mix(in_oklch,var(--gold),transparent_70%)] bg-card p-4 sm:p-6" aria-label="Metas y proyección">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="page-section-label flex items-center gap-1.5 text-[var(--gold)]"><Sparkles className="size-3.5" />Si sigues así</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">Metas y proyección</h2>
        </div>
        <Button size="sm" className="h-10 shrink-0" onClick={openGoalsEditor} disabled={locked}>
          <Flag className="size-4" />Nueva meta
        </Button>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background/40 p-4">
        <p className="text-xs text-muted-foreground">En 1 año tendrás</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight sm:text-3xl"><Sensitive>{eur(yearAhead)}</Sensitive></p>
        <p className="mt-1 text-xs text-muted-foreground">
          {avg === 0
            ? "Cuando haya ahorro en tus meses recientes, aquí verás la proyección."
            : <>Media de los últimos meses: <Sensitive>{eur(avg)}</Sensitive>/mes</>}
        </p>
      </div>

      <ul className="mt-4 space-y-3">
        {!loaded ? (
          <li className="h-16 animate-pulse rounded-xl bg-muted/40" aria-label="Cargando metas" />
        ) : sorted.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aún no tienes metas de patrimonio. Crea una para ver el progreso y en cuántos meses la alcanzarías.</li>
        ) : sorted.map((goal) => {
          const remaining = Math.max(0, goal.amount - netWorth)
          const pct = goal.amount <= 0 ? 100 : Math.max(0, Math.min(100, Math.round((netWorth / goal.amount) * 100)))
          const eta = monthsLabel(monthsToGoal(remaining, avg))
          const done = remaining <= 0
          return (
            <li key={goal.id} className="rounded-xl border border-border bg-background/40 p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Target className="size-4 shrink-0 text-primary" />
                    <span className="truncate">{goal.name || "Meta"}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground"><Sensitive>{eur(goal.amount)}</Sensitive></p>
                </div>
                <span className={cn("shrink-0 text-xs font-semibold tabular-nums", done ? "text-emerald-500" : "text-muted-foreground")}>{pct}%</span>
              </div>
              <Progress value={pct} className="mt-2 h-2 [&_[data-slot=progress-indicator]]:bg-[var(--gold)]" />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {done ? "Ya lo tienes" : <>Te faltan <Sensitive>{eur(remaining)}</Sensitive>{eta ? ` · a este ritmo, ${eta}` : " · cuando ahorres, estimaremos el plazo"}</>}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )

  if (locked) {
    return (
      <PaywallPreview locked title="Solo en Pro" description="La proyección a un año y las metas de patrimonio son de Garra Pro. Tus datos siguen ahí.">
        {body}
      </PaywallPreview>
    )
  }
  return body
}
