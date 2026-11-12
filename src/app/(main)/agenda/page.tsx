"use client"

import { useRecurringWithDebts } from "@/lib/use-assets-debts"
import { useMemo } from "react"
import Link from "next/link"
import { CalendarDays, HandCoins, Receipt, Check, CircleAlert, Clock3, Repeat2, X } from "@/components/icons"
import { useFinance, generateId } from "@/lib/store"
import { fixedVsVariable, showRecurringAsPaidThisMonth, type UpcomingRecurring } from "@/lib/calculations"
import { localDateKey, parseLocalDate } from "@/lib/date-utils"
import { convertToEur, formatMoney } from "@/lib/currency"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/empty-state"
import { Sensitive } from "@/components/shared/sensitive"
import { useToast } from "@/components/ui/toast"
import { openMovementDialog } from "@/components/layout/quick-actions"

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
  const recurring = useRecurringWithDebts(state.transactions)
  const todayDate = useMemo(() => parseLocalDate(today), [today])
  const overdue = useMemo(() => recurring.filter((item) => item.nextDate < today && !showRecurringAsPaidThisMonth(item, today, endDate, todayDate)).sort((a, b) => a.nextDate.localeCompare(b.nextDate)), [recurring, today, endDate, todayDate])
  const paidThisMonth = useMemo(() => recurring.filter((item) => showRecurringAsPaidThisMonth(item, today, endDate, todayDate)).sort((a, b) => b.lastDate.localeCompare(a.lastDate)), [recurring, today, endDate, todayDate])
  const upcoming = useMemo(() => recurring.filter((item) => item.nextDate >= today && item.nextDate <= endDate && !showRecurringAsPaidThisMonth(item, today, endDate, todayDate)).sort((a, b) => a.nextDate.localeCompare(b.nextDate)), [recurring, today, endDate, todayDate])
  const accountById = useMemo(() => new Map(state.accounts.map((account) => [account.id, account])), [state.accounts])
  const fixed = useMemo(() => fixedVsVariable(state.transactions, recurring, (amount, cuentaId) => convertToEur(amount, accountById.get(cuentaId)?.currency ?? "EUR")), [state.transactions, recurring, accountById])
  const fixedList = useMemo(() => [...recurring].sort((a, b) => (a.tipo === b.tipo ? parseLocalDate(a.nextDate).getDate() - parseLocalDate(b.nextDate).getDate() : a.tipo === "gasto" ? -1 : 1)), [recurring])
  const fixedShare = fixed.fixedExpenses + fixed.variableExpenses > 0 ? Math.round((fixed.fixedExpenses / (fixed.fixedExpenses + fixed.variableExpenses)) * 100) : 0
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
    if (item.key.startsWith("deuda:")) { toast("Esta cuota sale de una deuda: cámbiala o desactívala en Patrimonio.", "info"); return }
    const source = state.transactions.find((transaction) => transaction.id === item.sourceTransactionId)
    if (!source || !window.confirm(`¿Dejar de repetir «${item.descripcion || item.categoria}»? El historial se conservará.`)) return
    dispatch({ type: "UPDATE_TRANSACTION", payload: { ...source, tags: source.tags.filter((tag) => tag !== "recurrente" && !tag.startsWith("recurrente:") && !tag.startsWith("recurrente-dia:")) } })
    toast("Se ha detenido la recurrencia; el historial se conserva", "success")
  }

  const recurringCard = (item: UpcomingRecurring, isOverdue = false, isPaid = false) => {
    const account = accountById.get(item.cuenta_id)
    const isIncome = item.tipo === "ingreso"
    return (
      <article key={item.key} className={`flex min-w-0 flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:p-4 ${isPaid ? "border-border/60 bg-muted/30" : "border-border/80 bg-background/45"}`}>
        <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${isPaid ? "bg-muted text-muted-foreground" : isOverdue ? "bg-red-500/10 text-red-500" : isIncome ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"}`}>
          {isPaid ? <Check className="size-5" /> : isOverdue ? <CircleAlert className="size-5" /> : isIncome ? <HandCoins className="app-icon-tint size-5" /> : <Receipt className="app-icon-tint size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">{item.descripcion || item.categoria}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{item.categoria}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{account?.nombre ?? "Cuenta no disponible"}</span><span aria-hidden="true">·</span>
            <span>{frequencyLabel(item.frequency)}</span><span aria-hidden="true">·</span>
            <span className={isOverdue ? "font-medium text-red-500" : ""}>{formatDate(isPaid && item.lastDate ? item.lastDate : item.nextDate)}</span>
            {isOverdue && <span>· {item.overdueDays} {item.overdueDays === 1 ? "día de retraso" : "días de retraso"}</span>}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-3 sm:border-0 sm:pt-0">
          <Sensitive className={`text-base font-bold tabular-nums ${isIncome ? "text-emerald-500" : "text-foreground"}`}>
            {isIncome ? "+" : "−"}{formatMoney(item.monto, account?.currency ?? "EUR")}
          </Sensitive>
          <div className="flex shrink-0 items-center gap-1.5">
            {isPaid ? (
              <span className="inline-flex h-9 items-center gap-1.5 rounded-xl px-1 text-xs font-medium text-muted-foreground">
                <Check className="size-3.5 text-muted-foreground" /> Pagado este mes
              </span>
            ) : (
              <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5 rounded-xl px-3 text-xs" onClick={() => register(item)} disabled={!account} title={!account ? "La cuenta vinculada ya no existe" : undefined}>
                <Check className="size-3.5" /> Confirmar pago
              </Button>
            )}
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
          <p className="page-section-label">Agenda</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Gastos fijos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lo que pagas o cobras cada mes (alquiler, nómina, suscripciones…). Cuando llega el día te avisamos y lo confirmas con un toque; no cambia tus saldos hasta entonces.</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button type="button" className="min-h-10 gap-2 rounded-xl" onClick={() => openMovementDialog({ recurrente: true })}><Repeat2 className="size-4" /> Añadir gasto fijo</Button>
          <Link href="/transactions" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted">
            <CalendarDays className="size-4 text-primary" /> Movimientos
          </Link>
        </div>
      </header>

      {!loading && (
        <section className={`${CARD} space-y-4`} aria-labelledby="fixed-title">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div><p className="text-xs font-medium text-muted-foreground">Gastos fijos al mes</p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground"><Sensitive>{formatMoney(fixed.fixedExpenses, "EUR")}</Sensitive></p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Gastos variables al mes <span className="font-normal">(media 3 meses)</span></p><p className="mt-1 text-2xl font-bold tabular-nums text-foreground"><Sensitive>{formatMoney(fixed.variableExpenses, "EUR")}</Sensitive></p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Ingresos fijos al mes</p><p className="mt-1 text-2xl font-bold tabular-nums text-emerald-500"><Sensitive>{formatMoney(fixed.fixedIncome, "EUR")}</Sensitive></p></div>
          </div>
          {fixed.fixedExpenses + fixed.variableExpenses > 0 && (
            <div>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${fixedShare} % de tus gastos son fijos`}>
                <div className="h-full bg-primary" style={{ width: `${fixedShare}%` }} />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{fixedShare} % de tus gastos son fijos · {100 - fixedShare} % variables</p>
            </div>
          )}
          <div>
            <h2 id="fixed-title" className="mb-2 text-sm font-semibold">Tus gastos e ingresos fijos <span className="font-normal text-muted-foreground">· {fixedList.length}</span></h2>
            {fixedList.length ? (
              <ul className="divide-y divide-border/70">
                {fixedList.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 py-2 text-sm">
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${item.tipo === "ingreso" ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"}`}>{item.tipo === "ingreso" ? <HandCoins className="size-4" /> : <Receipt className="size-4" />}</span>
                    <span className="min-w-0 flex-1"><span className="line-clamp-1 font-medium">{item.descripcion || item.categoria}</span><span className="block text-xs text-muted-foreground">{item.frequency === "mensual" ? `Día ${parseLocalDate(item.nextDate).getDate()} de cada mes` : frequencyLabel(item.frequency)} · {accountById.get(item.cuenta_id)?.nombre ?? "Cuenta no disponible"}</span></span>
                    <Sensitive className={`shrink-0 font-semibold tabular-nums ${item.tipo === "ingreso" ? "text-emerald-500" : ""}`}>{item.tipo === "ingreso" ? "+" : "−"}{formatMoney(item.monto, accountById.get(item.cuenta_id)?.currency ?? "EUR")}</Sensitive>
                    <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-red-500" onClick={() => stop(item)} aria-label={`Dejar de repetir ${item.descripcion || item.categoria}`} title="Dejar de repetir"><X className="size-4" /></Button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Aún no tienes gastos fijos. Pulsa «Añadir gasto fijo» o marca «Repetir este movimiento» al apuntar un gasto.</p>}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen de agenda">
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Vencidos</p><p className={`mt-2 text-2xl font-bold tabular-nums ${overdue.length ? "text-red-500" : "text-foreground"}`}>{loading ? "—" : overdue.length}</p><p className="mt-1 text-xs text-muted-foreground">Requieren revisión</p></div>
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Ingresos · 30 días</p><p className="mt-2 truncate text-xl font-bold tabular-nums text-emerald-500"><Sensitive>{loading ? "—" : formatMoney(totals.income, "EUR")}</Sensitive></p><p className="mt-1 text-xs text-muted-foreground">{upcoming.filter((item) => item.tipo === "ingreso").length} {upcoming.filter((item) => item.tipo === "ingreso").length === 1 ? "previsto" : "previstos"}</p></div>
        <div className={CARD}><p className="text-xs font-medium text-muted-foreground">Pagos · 30 días</p><p className="mt-2 truncate text-xl font-bold tabular-nums text-foreground"><Sensitive>{loading ? "—" : formatMoney(totals.expenses, "EUR")}</Sensitive></p><p className="mt-1 text-xs text-muted-foreground">{upcoming.filter((item) => item.tipo === "gasto").length} {upcoming.filter((item) => item.tipo === "gasto").length === 1 ? "previsto" : "previstos"}</p></div>
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
        {loading ? <div className={`${CARD} h-32 animate-pulse`} /> : upcoming.length || paidThisMonth.length ? (
          <div className="space-y-2">
            {upcoming.map((item) => recurringCard(item))}
            {paidThisMonth.length > 0 && (
              <details className="rounded-xl border border-border/70 bg-card">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                  <Check className="size-4" /> Ver pagados este mes · {paidThisMonth.length}
                </summary>
                <div className="space-y-2 px-3 pb-3">{paidThisMonth.map((item) => recurringCard(item, false, true))}</div>
              </details>
            )}
          </div>
        ) : overdue.length === 0 ? (
          <div className={CARD}>
            <EmptyState icon={Repeat2} title="No hay movimientos programados" description="Crea un gasto o ingreso y activa la repetición. La agenda te avisará antes de cada vencimiento." />
            <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
              <Button type="button" className="min-h-10 rounded-xl" onClick={() => openMovementDialog({ recurrente: true })}>Crear movimiento recurrente</Button>
              <Link href="/transactions" className="inline-flex min-h-10 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted">Ver movimientos</Link>
            </div>
          </div>
        ) : <div className={`${CARD} text-sm text-muted-foreground`}>No hay nuevos vencimientos en los próximos 30 días.</div>}
      </section>

      {!loading && recurring.length > 0 && <p className="text-center text-xs leading-5 text-muted-foreground">Las fechas e importes son estimaciones basadas en la última operación de cada recurrencia. «Confirmar pago» añade el movimiento con la fecha de hoy y actualiza el saldo. Los ya registrados este mes aparecen como «Pagado este mes».</p>}
    </div>
  )
}
