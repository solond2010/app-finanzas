"use client"

import { useMemo } from "react"
import { Calendar, PiggyBank, TrendingDown, TrendingUp, Wallet } from "@/components/icons"
import { PaywallPreview } from "@/components/billing/paywall-preview"
import { Sensitive } from "@/components/shared/sensitive"
import { isProAccess, usePlan } from "@/lib/billing/use-plan"
import { buildMonthlySummary, moneyDelta } from "@/lib/billing/monthly-summary"
import { buildPreciseNetWorthHistoryMonthly, getCurrencyByAccount } from "@/lib/calculations"
import { formatMoney } from "@/lib/currency"
import { assetDebtNetAt } from "@/lib/assets-debts"
import { localDateKey } from "@/lib/date-utils"
import { useAssetsDebts } from "@/lib/use-assets-debts"
import { useFinance } from "@/lib/store"
import { cn } from "@/lib/utils"

const eur = (n: number) => formatMoney(n, "EUR")

function Spark({ values, tone }: { values: number[]; tone: "up" | "down" | "flat" }) {
  const max = Math.max(...values, 1)
  return (
    <div className="flex h-8 items-end gap-0.5" aria-hidden>
      {values.map((v, i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-t-sm sm:w-2", tone === "up" ? "bg-emerald-500/80" : tone === "down" ? "bg-red-400/80" : "bg-muted-foreground/40")}
          style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

export function MonthlySummaryCard({ netWorthNow }: { netWorthNow: number }) {
  const plan = usePlan()
  const locked = plan.enabled && !isProAccess(plan)
  const { state } = useFinance()
  const { assets, debts, values } = useAssetsDebts()

  const netWorthByMonth = useMemo(() => {
    const points = buildPreciseNetWorthHistoryMonthly(state.accounts, state.transactions, 8)
    const todayKey = localDateKey()
    const map: Record<string, number> = {}
    for (const p of points) {
      const key = p.date.slice(0, 7)
      map[key] = p.patrimonio + assetDebtNetAt(p.date, assets, values, debts, state.transactions, todayKey)
    }
    return map
  }, [state.accounts, state.transactions, assets, values, debts])

  const summary = useMemo(
    () => buildMonthlySummary({
      transactions: state.transactions,
      currencies: getCurrencyByAccount(state.accounts),
      netWorthNow,
      netWorthByMonth,
      today: localDateKey(),
    }),
    [state.transactions, state.accounts, netWorthNow, netWorthByMonth],
  )

  const body = (
    <section className="rounded-2xl border border-border/80 bg-card p-4 sm:p-6" aria-label={`Resumen mensual de ${summary.label}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="page-section-label flex items-center gap-1.5"><Calendar className="size-3.5" />Resumen mensual</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {summary.improved ? "Has mejorado este mes" : `Resumen de ${summary.label}`}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{summary.label} · una tarjeta dentro de Garra, sin correos.</p>
        </div>
        {summary.netWorthDelta !== null && (
          <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums", (summary.netWorthDelta ?? 0) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}>
            {moneyDelta(summary.netWorthDelta ?? 0)}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wallet className="size-3.5 text-primary" />Patrimonio</p>
          <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl"><Sensitive>{eur(summary.netWorth)}</Sensitive></p>
          {summary.netWorthDelta !== null && <p className={cn("text-[11px] tabular-nums", summary.netWorthDelta >= 0 ? "text-emerald-500" : "text-red-500")}>{moneyDelta(summary.netWorthDelta)} vs mes anterior</p>}
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><TrendingDown className="size-3.5 text-red-400" />Gastos del mes</p>
          <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl"><Sensitive>{eur(summary.expenses)}</Sensitive></p>
          <p className={cn("text-[11px] tabular-nums", summary.expensesDelta <= 0 ? "text-emerald-500" : "text-red-500")}>{moneyDelta(summary.expensesDelta)} vs mes anterior</p>
        </div>
        <div className="rounded-xl border border-border bg-background/40 p-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><PiggyBank className="size-3.5 text-emerald-500" />Ahorro del mes</p>
          <p className="mt-1 text-lg font-bold tabular-nums sm:text-xl"><Sensitive>{eur(summary.savings)}</Sensitive></p>
          <p className={cn("text-[11px] tabular-nums", summary.savingsDelta >= 0 ? "text-emerald-500" : "text-red-500")}>{moneyDelta(summary.savingsDelta)} vs mes anterior</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">Gastos de los últimos meses</p>
        <Spark values={summary.expenseHistory} tone={summary.expensesDelta <= 0 ? "up" : "down"} />
        <TrendingUp className={cn("size-4", summary.improved ? "text-emerald-500" : "text-muted-foreground")} />
      </div>
    </section>
  )

  if (locked) {
    return (
      <PaywallPreview locked title="Solo en Pro" description="El resumen mensual está en Pro. Se queda en la app: no enviamos correos.">
        {body}
      </PaywallPreview>
    )
  }
  return body
}
