"use client"

import type { Account } from "@/lib/store"
import { formatMoney } from "@/lib/currency"
import { calculateRemuneratedAccountForecast, formatForecastDate, INTEREST_FREQUENCIES } from "@/lib/remunerated-accounts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sensitive } from "@/components/shared/sensitive"
import { CalendarDays, Clock3, Pencil, Percent, TrendingUp } from "@/components/icons"
import type { ElementType } from "react"
import { useEffect, useState } from "react"

export function RemuneratedAccountPanel({ account, onEdit }: { account: Account; onEdit: () => void }) {
  const [today, setToday] = useState(() => new Date())
  useEffect(() => {
    const now = new Date()
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const timer = window.setTimeout(() => setToday(new Date()), Math.max(1000, midnight.getTime() - now.getTime() + 100))
    return () => window.clearTimeout(timer)
  }, [today])
  const configured = account.interest_tae != null
  const frequency = account.interest_frequency ?? "monthly"
  const frequencyLabel = INTEREST_FREQUENCIES.find((item) => item.value === frequency)?.label ?? "Mensual"
  const forecast = calculateRemuneratedAccountForecast({
    balance: account.saldo,
    annualTae: account.interest_tae ?? 0,
    frequency,
    startDate: account.interest_start_date,
    lastPaymentDate: account.interest_last_payment_date,
    balanceCap: account.interest_balance_cap,
    today,
  })

  return (
    <Card className="overflow-hidden rounded-[18px] border border-cyan-500/20 bg-gradient-to-br from-cyan-500/[0.06] via-card to-card">
      <CardContent className="space-y-5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-300"><Percent className="size-5" /></span>
            <div className="min-w-0">
              <h2 className="font-semibold tracking-tight">Intereses estimados</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{configured ? `${account.interest_tae?.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} % TAE · abono ${frequencyLabel.toLowerCase()}` : "Configura las condiciones de remuneración"}</p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 rounded-full" onClick={onEdit}><Pencil className="size-3.5" />{configured ? "Editar" : "Configurar"}</Button>
        </div>

        {configured ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric icon={TrendingUp} label="Por día" value={`+${formatMoney(forecast.dailyInterest, account.currency)}`} />
            <Metric icon={Clock3} label={account.interest_last_payment_date ? "Acumulado desde el abono" : "Acumulado desde el inicio"} value={formatMoney(forecast.accruedInterest, account.currency)} detail={forecast.accrualDate ? formatForecastDate(forecast.accrualDate) : "Añade una fecha"} />
            <Metric icon={CalendarDays} label="Próximo abono aprox." value={forecast.nextPaymentDate ? formatForecastDate(forecast.nextPaymentDate) : "Añade una fecha"} />
            <Metric icon={Percent} label="Proyección · 30 días" value={`+${formatMoney(forecast.thirtyDayInterest, account.currency)}`} detail={account.interest_balance_cap ? `Tope: ${formatMoney(account.interest_balance_cap, account.currency)}` : "Sobre el saldo actual"} detailSensitive={Boolean(account.interest_balance_cap)} />
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-background/45 px-4 py-3 text-sm text-muted-foreground">
            Añade la TAE y la frecuencia de pago para ver cuánto generaría esta cuenta.
          </div>
        )}

        <p className="border-t border-border/50 pt-3 text-[11px] leading-4 text-muted-foreground">
          Estimación orientativa según la TAE y el saldo actual, suponiendo que se mantiene durante el periodo. No se suma al saldo ni a tus ingresos; registra los intereses cuando el banco los abone realmente.
        </p>
      </CardContent>
    </Card>
  )
}

function Metric({ icon: Icon, label, value, detail, detailSensitive = false }: { icon: ElementType; label: string; value: string; detail?: string; detailSensitive?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/50 bg-background/45 p-3 sm:p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground"><Icon className="size-3.5 shrink-0 text-cyan-500" />{label}</div>
      <p className="mt-2 break-words text-sm font-bold leading-tight tabular-nums text-foreground sm:text-base"><Sensitive>{value}</Sensitive></p>
      {detail && <p className="mt-1 truncate text-[10px] text-muted-foreground">{detailSensitive ? <Sensitive>{detail}</Sensitive> : detail}</p>}
    </div>
  )
}
