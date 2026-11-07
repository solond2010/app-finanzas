"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { dcaPendingDates, planOf, useInvestments, type Position } from "@/lib/investments"
import { useToast } from "@/components/ui/toast"
import { fullySoldPositionIds, salesHistory, useInvestmentSales } from "@/lib/investment-sales"
import { useQuotes } from "@/lib/use-quotes"
import { computeInvestments, freshnessLabel, looksLikeCode, type PortfolioRow, type SliceKey } from "@/lib/portfolio"
import { useFinance } from "@/lib/store"
import { chartAxisFormatter, chartFormatter, money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Sensitive } from "@/components/shared/sensitive"
import { Skeleton } from "@/components/shared/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PositionDialog } from "@/components/investments/position-dialog"
import { PositionActionsDialog } from "@/components/investments/position-actions-dialog"
import { NetWorthChart } from "@/components/dashboard/net-worth-chart"
import { buildPreciseNetWorthHistory } from "@/lib/calculations"
import { chartSeries } from "@/lib/net-worth-chart"
import { usePrivacy } from "@/lib/privacy"
import { convertToEur, type CurrencyCode } from "@/lib/currency"
import { localDateKey } from "@/lib/date-utils"
import { AlertTriangle, ChartPieSlice, ChatText, HandCoins, PiggyBank, Plus, Repeat, TrendingUp } from "@/components/icons"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { CompanyLogo } from "@/components/investments/company-logo"
import { openFeedbackDialog } from "@/components/feedback/feedback-dialog"

const CARD = "min-w-0 rounded-2xl border border-border/80 bg-card p-4 sm:p-5"
const CLASS_COLORS: Record<SliceKey, string> = {
  sin_asignar: "#3A4250",
  fondos_indexados: "#5B9DFF", acciones: "#A78BFA", cripto: "#F5A524", renta_fija: "#2BD9A0",
  roboadvisor: "#38BDF8", oro: "#FFD08A", liquidez: "#8B95A5", otros: "#B08968",
}
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`)
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`
const tone = (n: number) => (n > 0 ? "text-[var(--accent-green)]" : n < 0 ? "text-[var(--accent-red,#FF6B5B)]" : "text-muted-foreground")
const unitPrice = (n: number, cur: string) => `${n.toLocaleString("es-ES", { maximumFractionDigits: n >= 100 ? 2 : 4 })} ${cur === "EUR" ? "€" : cur}`

/** Cotizaciones de mercado para las posiciones (no para las manuales). */
export default function InversionesPage() {
  const router = useRouter()
  const { state, loading } = useFinance()
  const { positions, contributions, loaded, update, applyDca, refresh, remove, retrySync } = useInvestments()
  const { quotes, ready } = useQuotes(positions)
  const { sales, addSale, refreshSales } = useInvestmentSales()
  // Al entrar en Inversiones: pedir de nuevo a la nube (otro dispositivo pudo vender/comprar).
  useEffect(() => {
    void refresh()
    void refreshSales({ pushLocalExtras: false })
  }, [refresh, refreshSales])

  // Venta total registrada pero posición aún abierta (delete que no llegó a la nube):
  // cerrarla y sincronizar. IREN y similares desaparecen al recargar sin acción manual.
  const closedRef = useRef(new Set<string>())
  useEffect(() => {
    if (!loaded || sales.length === 0) return
    const zombies = fullySoldPositionIds(positions, sales).filter((id) => !closedRef.current.has(id))
    if (zombies.length === 0) return
    let closed = 0
    for (const id of zombies) {
      closedRef.current.add(id)
      if (remove(id)) closed++
    }
    if (closed > 0) retrySync()
  }, [loaded, positions, sales, remove, retrySync])
  const year = String(new Date().getFullYear())
  const history = useMemo(() => salesHistory(sales, state.transactions, state.accounts, year), [sales, state.transactions, state.accounts, year])
  // Si una posición se guardó con el código como nombre, se guarda una vez el
  // nombre legible que da la cotización.
  const renamed = useRef(new Set<string>())
  useEffect(() => {
    for (const p of positions) {
      const q = quotes[p.symbol]
      if (p.kind === "custom" || !q?.name || renamed.current.has(p.id) || !looksLikeCode(p.name || "", p.symbol) || looksLikeCode(q.name, p.symbol)) continue
      renamed.current.add(p.id)
      update({ ...p, name: q.name })
    }
  }, [positions, quotes, update])
  const [dialog, setDialog] = useState<{ open: boolean; editing: Position | null; accountId?: string }>({ open: false, editing: null })
  const view = useMemo(() => computeInvestments(state.accounts, positions, quotes, contributions), [state.accounts, positions, quotes, contributions])
  const { privacy } = usePrivacy()
  const todayKey = localDateKey()
  // Evolución del valor de las cuentas de inversión (mismo saldo que en Cuentas).
  const portfolioSeries = useMemo(() => {
    const ids = new Set(view.accounts.map((a) => a.id))
    const invAccounts = state.accounts.filter((a) => ids.has(a.id))
    if (invAccounts.length === 0) return { points: [], monthly: false as boolean }
    const daily = buildPreciseNetWorthHistory(invAccounts, state.transactions, 180)
    const points = daily.map((p) => ({ date: p.date, value: p.patrimonio, label: p.label }))
    return chartSeries(points, todayKey)
  }, [view.accounts, state.accounts, state.transactions, todayKey])
  const portfolioHasChart = portfolioSeries.points.length >= 2 && portfolioSeries.points.some((p) => Math.abs(p.value) >= 0.5)
  const account = (id: string) => state.accounts.find((x) => x.id === id)
  const maxMonth = Math.max(...view.months.map((m) => m.amount), 1)
  const year12 = view.months.reduce((s, m) => s + m.amount, 0)

  const openNew = (accountId?: string) => setDialog({ open: true, editing: null, accountId })
  const [acting, setActing] = useState<{ id: string; orphan: boolean } | null>(null)
  const actingPosition = acting ? positions.find((x) => x.id === acting.id) ?? null : null
  const actingRow = acting ? [...view.accounts.flatMap((a) => a.rows), ...view.orphans].find((r) => r.id === acting.id) ?? null : null
  const openEdit = (id: string, orphan = false) => setActing({ id, orphan })
  const unassignedByAccount = useMemo(() => Object.fromEntries(view.accounts.map((a) => [a.id, a.unassigned])) as Record<string, number>, [view.accounts])
  // Aportes automáticos: al tener precios se aplican los vencidos. Cada mes
  // tiene un id fijo y antes de aplicar se relee la nube, así que no se
  // cuenta dos veces ni aunque haya dos dispositivos abiertos.
  const { toast } = useToast()
  const dcaDone = useRef(new Set<string>())
  useEffect(() => {
    if (!loaded || !ready) return
    for (const p of positions) {
      const plan = planOf(p)
      const key = `${p.id}:${p.dcaLast ?? p.date}`
      const due = plan ? dcaPendingDates(plan).length : 0
      if (!plan || dcaDone.current.has(key) || due === 0) continue
      dcaDone.current.add(key)
      const price = quotes[p.symbol]?.price || p.buyPrice
      const free = p.accountId ? unassignedByAccount[p.accountId] : undefined
      const short = free !== undefined && convertToEur(due * plan.amount, p.currency as CurrencyCode) > free + 0.5
      void applyDca(p.id, price).then((n) => {
        if (n <= 0) return
        if (short) toast(`Aporte aplicado sin saldo libre suficiente en la cuenta: actualiza su saldo en Cuentas`, "error")
        else toast(n === 1 ? "Aporte periódico aplicado" : `${n} aportes periódicos aplicados`, "success")
      })
      break // una posición por pasada: el estado local se actualiza y el efecto sigue con la siguiente
    }
  }, [loaded, ready, positions, quotes, applyDca, toast, unassignedByAccount])
  // Mes del último aporte automático de cada cuenta (para el aviso de saldo).
  const lastAutoByAccount = useMemo(() => {
    const out: Record<string, string> = {}
    for (const c of contributions) {
      if (!c.id.startsWith("dca:")) continue
      const acc = positions.find((p) => p.id === c.positionId)?.accountId
      if (acc && (!out[acc] || c.date > out[acc])) out[acc] = c.date
    }
    return out
  }, [contributions, positions])
  const hasPositions = view.accounts.some((a) => a.rows.length > 0)
  const betaBanner = (
    <div
      role="status"
      className="rounded-2xl border border-[color-mix(in_oklch,var(--gold),transparent_70%)] bg-[color-mix(in_oklch,var(--gold),transparent_92%)] px-3.5 py-3 sm:px-4"
    >
      <p className="text-sm leading-snug text-foreground">
        <span className="font-semibold text-[var(--gold)]">Beta · </span>
        Esta sección aún está en pruebas. Si ves un fallo o quieres añadir algo,{" "}
        <button
          type="button"
          onClick={() => openFeedbackDialog()}
          className="inline-flex items-center gap-1 font-semibold text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        >
          <ChatText className="size-3.5 shrink-0" aria-hidden />
          envíanos un comentario
        </button>
        {" "}(mismo botón del menú lateral).
      </p>
    </div>
  )

  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Inversiones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tus cuentas de inversión y en qué está invertido su dinero.</p>
      </div>
      {view.accounts.length > 0 && <Button variant="outline" onClick={() => openNew()}><Plus className="size-4 text-primary" />Añadir posición</Button>}
    </header>
  )
  const dialogEl = (
    <>
      <PositionDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} editing={dialog.editing} defaultAccountId={dialog.accountId} unassignedByAccount={unassignedByAccount} />
      <PositionActionsDialog position={actingPosition} row={actingRow} onClose={() => setActing(null)} onEdit={(p) => setDialog({ open: true, editing: acting?.orphan ? { ...p, accountId: undefined } : p })} onSold={addSale} />
    </>
  )

  if (loading || !loaded || (positions.length > 0 && !ready)) {
    return <div className="space-y-4 sm:space-y-5">{header}{betaBanner}<div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-56" /><Skeleton className="h-56" /></div><Skeleton className="h-72" /></div>
  }
  if (view.accounts.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-5">
        {header}
        {betaBanner}
        <EmptyState bordered icon={ChartPieSlice} title="Aún no tienes cuentas de inversión" description="Crea en Cuentas una cuenta de tipo «Inversión» (tu bróker, fondos…) con su saldo. Luego aquí podrás decir en qué acciones, fondos o ETF está ese dinero." action={{ label: "Ir a Cuentas", onClick: () => router.push("/cuentas#nueva") }} />
        {dialogEl}
      </div>
    )
  }

  // Anillo de reparto: segmentos sobre una circunferencia de 100 unidades.
  const ring = view.allocation.map((a, i) => ({ ...a, offset: 25 - view.allocation.slice(0, i).reduce((s, x) => s + x.pct, 0) }))
  const positionRow = (r: PortfolioRow, orphan = false) => (
    <li key={r.id}>
      <button type="button" onClick={() => openEdit(r.id, orphan)} className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <CompanyLogo
          name={r.name}
          symbol={r.code?.split(" · ")[0]}
          crypto={r.assetClass === "cripto"}
          accent={CLASS_COLORS[r.assetClass]}
          className="size-7 sm:size-8"
        />
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 block break-words text-sm font-medium text-foreground">{r.name}</span>
          {r.code && <span className="block truncate font-mono text-[10px] text-muted-foreground/80">{r.code}</span>}
          <span className="block text-xs text-muted-foreground"><Sensitive>{r.units.toLocaleString("es-ES", { maximumFractionDigits: 4 })}</Sensitive> uds. · coste {unitPrice(r.avgCost, r.priceCurrency)}{r.hasQuote ? ` · hoy ${unitPrice(r.price, r.priceCurrency)}` : ""}</span>
          <span className="block text-[11px] text-muted-foreground/80">{r.hasQuote ? `Precio de mercado · ${freshnessLabel(r.quoteTime) ?? "sin hora"}` : "Precio de compra (sin cotización)"}</span>
        </span>
        <span className="shrink-0 text-right tabular-nums">
          <Sensitive className="block text-sm font-semibold text-foreground">{money(r.value)}</Sensitive>
          {r.hasQuote && <span className={cn("block text-xs font-medium", tone(r.gain))}><Sensitive>{signed(r.gain)}</Sensitive> · {pct(r.gainPct)}</span>}
        </span>
      </button>
    </li>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      {header}
      {betaBanner}

      <section className={cn("grid gap-4", hasPositions && "lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]")}>
        <div className="min-w-0 rounded-2xl hero-panel p-4 sm:p-6">
          <p className="page-section-label">Valor de mercado</p>
          <p className="hero-figure mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums sm:text-[42px]"><Sensitive>{money(view.total)}</Sensitive></p>
          <p className="mt-2 text-sm text-muted-foreground">{view.accounts.length === 1 ? "1 cuenta de inversión" : `${view.accounts.length} cuentas de inversión`} · posiciones + efectivo real</p>
          {hasPositions && <p className="mt-3 text-xs text-muted-foreground"><Sensitive className="tabular-nums">{money(view.assigned)}</Sensitive> en posiciones{view.unassigned > 0.005 ? <> · <Sensitive className="tabular-nums">{money(view.unassigned)}</Sensitive> sin asignar</> : null}{view.capital > 0 ? <> · <Sensitive className="tabular-nums">{money(view.capital)}</Sensitive> en cuenta</> : null}</p>}
        </div>

        {hasPositions && <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-1">
          <div className={CARD}>
            <p className="page-section-label flex items-center gap-1.5"><PiggyBank className="size-4 text-primary" />Ganancia</p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tone(view.gain))}><Sensitive>{signed(view.gain)}</Sensitive></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{view.gainPct === null ? "Añade posiciones para verla" : `${pct(view.gainPct)} en posiciones con cotización`}</p>
          </div>
          <div className={CARD}>
            <p className="page-section-label flex items-center gap-1.5"><Repeat className="size-4 text-primary" />Aportas al mes</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-primary sm:text-2xl"><Sensitive>{money(view.monthlyPlan)}</Sensitive></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{view.monthlyPlan > 0 ? "Con tus aportaciones periódicas" : "Sin aportación periódica"}</p>
          </div>
        </div>}
      </section>

      {portfolioHasChart && (
        <section className={CARD} aria-label="Evolución de la cartera">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><TrendingUp className="size-4 text-primary" aria-hidden />Evolución de la cartera</p>
            <p className="text-xs text-muted-foreground">Valor de tus cuentas de inversión · pasa el dedo o el ratón para ver el detalle</p>
          </div>
          <div className="mt-3 h-44 sm:h-56">
            <NetWorthChart
              points={portfolioSeries.points}
              monthly={portfolioSeries.monthly}
              formatValue={chartFormatter}
              formatAxis={chartAxisFormatter}
              hideValues={privacy}
              className="h-full"
            />
          </div>
        </section>
      )}

      <section className={cn("grid items-start gap-4", hasPositions && "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]")}>
        <div className={cn("grid min-w-0 gap-4", !hasPositions && "md:grid-cols-2")}>
          {view.accounts.map((a) => {
            const share = a.marketValue > 0 ? Math.min(100, (a.positionsValue / a.marketValue) * 100) : 0
            return (
              <div key={a.id} className={CARD}>
                <div className="flex items-start gap-3">
                  {account(a.id) && <AccountLogo account={account(a.id)!} className="h-10 w-10 shrink-0 rounded-xl" />}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words font-semibold text-foreground">{a.name}</p>
                    {a.bank && <p className="text-xs text-muted-foreground">{a.bank}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <Sensitive className="block text-lg font-bold tabular-nums text-foreground">{money(a.marketValue)}</Sensitive>
                    <span className="text-[11px] text-muted-foreground">valor hoy</span>
                    {a.rows.some((r) => r.hasQuote) && Math.abs(a.gain) >= 0.005 && (
                      <span className={cn("block text-[11px] font-medium tabular-nums", tone(a.gain))}><Sensitive>{signed(a.gain)}</Sensitive></span>
                    )}
                    <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground"><Sensitive>{money(a.balance)}</Sensitive> en cuenta</span>
                  </div>
                </div>
                {a.rows.length > 0 && <>
                <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className="h-full bg-primary" style={{ width: `${share}%` }} /></div>
                <ul className="mt-2 divide-y divide-border/60">{a.rows.map((r) => positionRow(r))}</ul>
                <div className="mt-1 flex items-center gap-3 border-t border-border/60 px-1 pt-2.5">
                  <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden />
                  <span className="min-w-0 flex-1 text-sm text-muted-foreground">Sin asignar <span className="text-xs">(efectivo o sin detallar)</span></span>
                  <Sensitive className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{money(a.unassigned)}</Sensitive>
                </div>
                </>}
                {a.over && <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{lastAutoByAccount[a.id]
                  ? `Aporte de ${new Date(`${lastAutoByAccount[a.id]}T12:00:00`).toLocaleDateString("es-ES", { month: "long" })} aplicado sin saldo libre suficiente: actualiza el saldo de la cuenta.`
                  : <>El coste de las posiciones ({money(a.positionsCost)}) supera bastante el saldo en cuenta ({money(a.balance)}). Actualiza el saldo en Cuentas o revisa las posiciones.</>}</p>}
                <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => openNew(a.id)}><Plus className="size-4" />{a.rows.length > 0 ? "Añadir posición aquí" : "Detallar en qué está invertido"}</Button>
              </div>
            )
          })}
          {view.orphans.length > 0 && (
            <div className={cn(CARD, "border-dashed")}>
              <p className="font-semibold text-foreground">Sin cuenta</p>
              <p className="mt-0.5 text-xs text-muted-foreground">No suman al total. Tócalas y elige su cuenta de inversión.</p>
              <ul className="mt-2 divide-y divide-border/60">{view.orphans.map((r) => positionRow(r, true))}</ul>
            </div>
          )}
        </div>

        {hasPositions && <div className="grid min-w-0 gap-4">
          <div className={CARD}>
            <p className="text-sm font-semibold text-foreground">Reparto por tipo</p>
            <div className="mt-3 flex items-center gap-5">
              <svg viewBox="0 0 42 42" className="size-28 shrink-0" role="img" aria-label="Reparto del total por tipo de activo">
                <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--muted)" strokeWidth="6" />
                {ring.map((a) => <circle key={a.key} cx="21" cy="21" r="15.915" fill="none" stroke={CLASS_COLORS[a.key]} strokeWidth="6" strokeDasharray={`${a.pct} ${100 - a.pct}`} strokeDashoffset={a.offset} />)}
              </svg>
              <ul className="min-w-0 space-y-1.5 text-sm">
                {view.allocation.map((a) => (
                  <li key={a.key} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CLASS_COLORS[a.key] }} aria-hidden />
                    <span className="min-w-0 truncate text-foreground">{a.label}</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(a.pct)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className={CARD}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Aportaciones a posiciones</p>
              <p className="text-xs text-muted-foreground">12 meses · <Sensitive className="tabular-nums">{money(year12)}</Sensitive></p>
            </div>
            <div className="mt-3 flex h-24 items-end gap-1.5" role="img" aria-label="Aportaciones de los últimos 12 meses">
              {view.months.map((m) => (
                <div key={m.key} className="flex h-full flex-1 items-end" title={`${MONTHS[Number(m.key.slice(5)) - 1]}: ${money(m.amount)}`}>
                  <div className={cn("w-full rounded-t-[5px] rounded-b-[2px]", m.amount > 0 ? "bg-primary/75" : "bg-muted")} style={{ height: m.amount > 0 ? `${Math.max(6, (m.amount / maxMonth) * 100)}%` : "4px" }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              {view.months.filter((_, i) => i % 3 === 0 || i === 11).map((m) => <span key={m.key}>{MONTHS[Number(m.key.slice(5)) - 1]}</span>)}
            </div>
          </div>
        </div>}
      </section>
      {history.rows.length > 0 && (
        <section className={CARD} aria-label="Ventas">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><HandCoins className="size-4 text-primary" aria-hidden />Ventas</p>
            <p className="text-xs text-muted-foreground">Ganado en {year}: <Sensitive className={cn("font-semibold tabular-nums", tone(history.realizedYear))}>{signed(history.realizedYear)}</Sensitive></p>
          </div>
          <ul className="mt-3 divide-y divide-border/70">
            {history.rows.slice(0, 20).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{r.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {new Date(`${r.date}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                    {r.units !== null ? <> · <Sensitive>{r.units.toLocaleString("es-ES", { maximumFractionDigits: 4 })}</Sensitive> uds.</> : " · venta anterior"}
                    {r.commission != null && r.commission > 0 ? <> · comisión <Sensitive>{money(r.commission)}</Sensitive></> : null}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {r.received !== null && <Sensitive className="block text-sm tabular-nums text-foreground">{money(r.received)}</Sensitive>}
                  <Sensitive className={cn("block text-xs font-medium tabular-nums", tone(r.gain))}>{signed(r.gain)}</Sensitive>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {dialogEl}
    </div>
  )
}
