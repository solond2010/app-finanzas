"use client"

import { useMemo } from "react"
import Link from "next/link"
import { ArrowDownRight, ArrowUpRight, CalendarDays, Check, CircleAlert, Clock3, Repeat2, X } from "lucide-react"
import { useFinance, generateId } from "@/lib/store"
import { getUpcomingRecurring, type UpcomingRecurring } from "@/lib/calculations"
import { localDateKey, parseLocalDate } from "@/lib/date-utils"
import { convertToEur, formatMoney } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Sensitive } from "@/components/shared/sensitive"
import { useToast } from "@/components/ui/toast"

const CARD = "rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"

function formatDate(value: string) {
  return parseLocalDate(value).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
}

function frequencyLabel(frequency: UpcomingRecurring["frequency"]) {
  return frequency === "semanal" ? "Cada semana" : frequency === "anual" ? "Cada año" : "Cada mes"
}

export default function AgendaPage() {
  const { state, loading, dispatch } = useFinance()
  const { toast } = useToast()
  const today = useMemo(() => localDateKey(), [])
  const endDate = useMemo(() => {
    const date = parseLocalDate(today)
    date.setDate(date.getDate() + 30)
    return localDateKey(date)
  }, [today])
  const recurring = useMemo(() => getUpcomingRecurring(state.transactions), [state.transactions])
  const overdue = useMemo(() => recurring.filter((item) => item.nextDate < today).sort((a, b) => a.nextDate.localeCompare(b.nextDate)), [recurring, today])
  const upcoming = useMemo(() => recurring.filter((item) => item.nextDate >= today && item.nextDate <= endDate).sort((a, b) => a.nextDate.localeCompare(b.nextDate)), [recurring, today, endDate])
  const accountById = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts])
  const totals = useMemo(() => upcoming.reduce((sum, item) => {
    const amount = convertToEur(item.monto, accountById.get(item.cuenta_id)?.currency ?? "EUR")
    if (item.tipo === "ingreso") sum.income += amount
    else sum.expenses += amount
    return sum
  }, { income: 0, expenses: 0 }), [upcoming, accountById])

  const register = (item: UpcomingRecurring) => {
    if (!accountById.has(item.cuenta_id)) {
      toast("La cuenta de esta recurrencia ya no existe; no se ha creado ningún movimiento.", "error")
      return
    }
    dispatch({
      type: "ADD_TRANSACTION",
      payload: {
        // La agenda es una previsión. Cuando el usuario confirma que ya pasó,
        // registrar la fecha real de hoy evita alterar un saldo actual con una
        // transacción futura o vencida.
        id: generateId(), cuenta_id: item.cuenta_id, monto: item.monto, fecha: localDateKey(),
      tipo: item.tipo, categoria: item.categoria, es_necesidad: item.es_necesidad,
        descripcion: item.descripcion, tags: item.tags,
      },
    })
    toast("Movimiento recurrente registrado", "success")
  }

  const stop = (item: UpcomingRecurring) => {
    const source = state.transactions.find((transaction) => transaction.id === item.sourceTransactionId)
    if (!source || !window.confirm(`¿Dejar de repetir «${item.descripcion || item.categoria}»? El historial se conservará.`)) return
    dispatch({ type: "UPDATE_TRANSACTION", payload: { ...source, tags: source.tags.filter((tag) => tag !== "recurrente" && !tag.startsWith("recurrente:") && !tag.startsWith("recurrente-dia:")) } })
    toast("Se ha detenido la recurrencia; el historial se conserva", "success")
  }

  const recurringCard = (item: UpcomingRecurring, isOverdue = false) => {
    const account = accountById.get(item.cuenta_id)
    const isIncome = item.tipo === "ingreso"
    return (
      <article key={item.key} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/80 bg-background/45 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isOverdue ? "bg-red-500/10 text-red-500" : isIncome ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"}`}>
          {isOverdue ? <CircleAlert className="size-5" /> : isIncome ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{item.descripcion || item.categoria}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{item.categoria}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{account?.nombre ?? "Cuenta no disponible"}</span><span aria-hidden="true">·</span>
            <span>{frequencyLabel(item.frequency)}</span><span aria-hidden="true">·</span>
            <span className={isOverdue ? "font-medium text-red-500" : ""}>{formatDate(item.nextDate)}</span>
            {isOverdue && <span>· {item.overdueDays} {item.overdueDays === 1 ? "día de retraso" : "días de retraso"}</span>}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 sm:border-0 sm:pt-0">
          <Sensitive className={`text-base font-bold tabular-nums ${isIncome ? "text-emerald-500" : "text-foreground"}`}>
            {isIncome ? "+" : "−"}{formatMoney(item.monto, account?.currency ?? "EUR")}
          </Sensitive>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl px-3 text-xs" onClick={() => register(item)} disabled={!account} title={!account ? "La cuenta vinculada ya no existe" : undefined}>
              <Check className="size-3.5" /> Ya se realizó
            </Button>
            <Button type="button" size="icon" variant="ghost" className="size-9 rounded-xl text-muted-foreground hover:text-red-500" onClick={() => stop(item)} aria-label={`Dejar de repetir ${item.descripcion || item.categoria}`} title="Dejar de repetir">
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </article>
    )
  }

  return (
    <div className="content-fade mx-auto w-full max-w-6xl space-y-5 sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-section-label">Planificación</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">Previsión de pagos e ingresos recurrentes; no crea movimientos ni cambia saldos hasta que confirmes que ya ocurrieron.</p>
        </div>
        <Link href="/transactions" className="inline-flex min-h-10 items-center gap-2 self-start rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:self-auto">
          <CalendarDays className="size-4 text-primary" /> Gestionar movimientos
        </Link>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de agenda">
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Vencidos</p><p className={`mt-2 text-2xl font-bold tabular-nums ${overdue.length ? "text-red-500" : "text-foreground"}`}>{loading ? "—" : overdue.length}</p><p className="mt-1 text-xs text-muted-foreground">Requieren revisión</p></div>
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Ingresos · 30 días</p><p className="mt-2 truncate text-xl font-bold tabular-nums text-emerald-500"><Sensitive>{loading ? "—" : formatMoney(totals.income, "EUR")}</Sensitive></p><p className="mt-1 text-xs text-muted-foreground">{upcoming.filter((item) => item.tipo === "ingreso").length} previstos</p></div>
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Pagos · 30 días</p><p className="mt-2 truncate text-xl font-bold tabular-nums text-foreground"><Sensitive>{loading ? "—" : formatMoney(totals.expenses, "EUR")}</Sensitive></p><p className="mt-1 text-xs text-muted-foreground">{upcoming.filter((item) => item.tipo === "gasto").length} previstos</p></div>
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Previsión neta · 30 días</p><p className={`mt-2 truncate text-xl font-bold tabular-nums ${totals.income - totals.expenses >= 0 ? "text-emerald-500" : "text-red-500"}`}><Sensitive>{loading ? "—" : formatMoney(totals.income - totals.expenses, "EUR")}</Sensitive></p><p className="mt-1 text-xs text-muted-foreground">Solo recurrencias registradas</p></div>
      </section>

      {!loading && overdue.length > 0 && (
        <section className="space-y-3" aria-labelledby="overdue-title">
          <div className="flex items-center gap-2"><CircleAlert className="size-4 text-red-500" /><h2 id="overdue-title" className="text-base font-semibold">Pendientes de revisar</h2><span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-500">{overdue.length}</span></div>
          <div className="space-y-2">{overdue.map((item) => recurringCard(item, true))}</div>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="upcoming-title">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Clock3 className="size-4 text-primary" /><h2 id="upcoming-title" className="text-base font-semibold">Próximos 30 días</h2></div>
          {!loading && <span className="text-xs text-muted-foreground">{upcoming.length} {upcoming.length === 1 ? "movimiento" : "movimientos"}</span>}
        </div>
        {loading ? <div className={`${CARD} h-32 animate-pulse`} /> : upcoming.length ? (
          <div className="space-y-2">{upcoming.map((item) => recurringCard(item))}</div>
        ) : overdue.length === 0 ? (
          <div className={CARD}>
            <EmptyState icon={Repeat2} title="No hay movimientos programados" description="Marca un movimiento como recurrente al crearlo o editarlo y aparecerá aquí." />
            <div className="mt-4 flex justify-center"><Link href="/transactions" className="inline-flex min-h-10 items-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">Ir a movimientos</Link></div>
          </div>
        ) : <div className={`${CARD} text-sm text-muted-foreground`}>No hay nuevos vencimientos en los próximos 30 días.</div>}
      </section>

      {!loading && recurring.length > 0 && <p className="text-center text-xs leading-5 text-muted-foreground">Las fechas e importes son estimaciones basadas en la última operación de cada recurrencia. «Ya se realizó» añade el movimiento con la fecha de hoy y actualiza el saldo.</p>}
    </div>
  )
}
