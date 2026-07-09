"use client"

import { CalendarClock, Repeat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useInvestments, dcaPendingDates, dcaNextDate, planOf } from "@/lib/investments"
import { useToast } from "@/components/ui/toast"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"

interface Quote { price: number; currency: string; changePct?: number | null }

const CARD = "rounded-[16px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"

export function DcaPanel({ quotes }: { quotes: Record<string, Quote> }) {
  const { positions, applyDca } = useInvestments()
  const { toast } = useToast()

  const plans = positions
    .map((p) => ({ p, plan: planOf(p) }))
    .filter((x): x is { p: typeof x.p; plan: NonNullable<typeof x.plan> } => x.plan !== null)
    .map(({ p, plan }) => {
      const pending = dcaPendingDates(plan)
      const next = dcaNextDate(plan)
      const price = p.kind === "custom" ? p.buyPrice : quotes[p.symbol]?.price ?? p.buyPrice
      return { p, plan, pending, next, price }
    })

  if (plans.length === 0) return null

  const fmtDate = (d: Date) => d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" })

  const handleApply = (positionId: string, price: number) => {
    const n = applyDca(positionId, price)
    if (n > 0) toast(`${n} aporte${n > 1 ? "s" : ""} aplicado${n > 1 ? "s" : ""}`, "success")
  }

  return (
    <section className={CARD}>
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"><Repeat className="h-4 w-4" /></span>
        <div>
          <p className="page-section-label">Aportes programados (DCA)</p>
          <p className="text-xs text-muted-foreground">Tus compras periódicas. Aplica los vencidos al precio de mercado.</p>
        </div>
      </div>
      <p className="mt-3 rounded-xl bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        Aplicar un aporte suma las unidades a la posición pero <strong className="font-semibold text-foreground">no descuenta el importe de ninguna cuenta</strong> todavía — regístralo tú como transacción si quieres que se refleje en el patrimonio líquido.
      </p>

      <div className="mt-4 space-y-3">
        {plans.map(({ p, plan, pending, next, price }) => {
          const cur = p.currency as CurrencyCode
          const hasPending = pending.length > 0
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-muted/20 p-3">
              <span className="gold-badge flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold">{p.symbol.replace("custom:", "").slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  <Sensitive as="span">{formatMoney(plan.amount, cur)}</Sensitive> · {plan.freq === "monthly" ? "mensual" : "semanal"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                {hasPending ? (
                  <p className="text-xs font-semibold" style={{ color: "var(--gold)" }}>{pending.length} pendiente{pending.length > 1 ? "s" : ""}</p>
                ) : (
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> {fmtDate(next)}</p>
                )}
              </div>
              {hasPending && (
                <Button size="sm" className="shrink-0 rounded-full" onClick={() => handleApply(p.id, price)}>
                  Aplicar <Sensitive as="span">{formatMoney(pending.length * plan.amount, cur)}</Sensitive>
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
