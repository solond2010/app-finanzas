"use client"

import { useEffect, useMemo, useState } from "react"
import { useInvestments, type AssetClass, type Position } from "@/lib/investments"
import { computePortfolio, type Quote } from "@/lib/portfolio"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Sensitive } from "@/components/shared/sensitive"
import { Skeleton } from "@/components/shared/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { Button } from "@/components/ui/button"
import { PositionDialog } from "@/components/investments/position-dialog"
import { ChartLineUp, PiggyBank, Plus, Repeat, TrendingDown, TrendingUp } from "@/components/icons"

const CARD = "min-w-0 rounded-2xl border border-border/80 bg-card p-4 sm:p-5"
const CLASS_COLORS: Record<AssetClass, string> = {
  fondos_indexados: "#5B9DFF", acciones: "#A78BFA", cripto: "#F5A524", renta_fija: "#2BD9A0",
  roboadvisor: "#38BDF8", oro: "#FFD08A", liquidez: "#8B95A5", otros: "#B08968",
}
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toLocaleString("es-ES", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} %`)
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`
const tone = (n: number) => (n > 0 ? "text-[var(--accent-green)]" : n < 0 ? "text-[var(--accent-red,#FF6B5B)]" : "text-muted-foreground")
const unitPrice = (n: number, cur: string) => `${n.toLocaleString("es-ES", { maximumFractionDigits: n >= 100 ? 2 : 4 })} ${cur === "EUR" ? "€" : cur}`

/** Cotizaciones de mercado para las posiciones (no para las manuales). */
function useQuotes(positions: Position[]) {
  const symbols = useMemo(() => [...new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))].sort().join(","), [positions])
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!symbols) { queueMicrotask(() => setReady(true)); return }
    let alive = true
    fetch(`/api/quote?symbols=${encodeURIComponent(symbols)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { quotes?: Record<string, Quote> } | null) => { if (alive) { setQuotes(d?.quotes ?? {}); setReady(true) } })
      .catch(() => { if (alive) setReady(true) })
    return () => { alive = false }
  }, [symbols])
  return { quotes, ready }
}

export default function InversionesPage() {
  const { positions, contributions, loaded } = useInvestments()
  const { quotes, ready } = useQuotes(positions)
  const [dialog, setDialog] = useState<{ open: boolean; editing: Position | null }>({ open: false, editing: null })
  const portfolio = useMemo(() => computePortfolio(positions, quotes, contributions), [positions, quotes, contributions])
  const maxMonth = Math.max(...portfolio.months.map((m) => m.amount), 1)
  const year12 = portfolio.months.reduce((s, m) => s + m.amount, 0)
  const missingQuotes = ready && portfolio.rows.some((r) => !r.hasQuote)

  const openNew = () => setDialog({ open: true, editing: null })
  const header = (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Inversiones</h1>
        <p className="mt-1 text-sm text-muted-foreground">Lo que has aportado frente a lo que vale hoy.</p>
      </div>
      <Button variant="outline" onClick={openNew}><Plus className="size-4 text-primary" />Añadir posición</Button>
    </header>
  )
  const dialogEl = <PositionDialog open={dialog.open} onOpenChange={(open) => setDialog((d) => ({ ...d, open }))} editing={dialog.editing} />

  if (!loaded || (positions.length > 0 && !ready)) {
    return <div className="space-y-5">{header}<div className="grid gap-4 lg:grid-cols-[2fr_1fr]"><Skeleton className="h-56" /><Skeleton className="h-56" /></div><Skeleton className="h-72" /></div>
  }
  if (positions.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <EmptyState bordered icon={ChartLineUp} title="Aún no tienes inversiones" description="Añade tus fondos, acciones o cripto y verás cuánto has aportado, cuánto vale hoy y cuánto ganas." action={{ label: "Añadir posición", icon: Plus, onClick: openNew }} />
        {dialogEl}
      </div>
    )
  }

  const up = portfolio.gain >= 0
  const barMax = Math.max(portfolio.invested, portfolio.value, 1)
  // Anillo de reparto: segmentos sobre una circunferencia de 100 unidades.
  const ring = portfolio.allocation.map((a, i) => ({ ...a, offset: 25 - portfolio.allocation.slice(0, i).reduce((s, x) => s + x.pct, 0) }))

  return (
    <div className="space-y-4 sm:space-y-5">
      {header}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-2xl hero-panel p-4 sm:p-6">
          <p className="page-section-label">Valor de la cartera</p>
          <p className="hero-figure mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums sm:text-[42px]"><Sensitive>{money(portfolio.value)}</Sensitive></p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", up ? "bg-emerald-500/12 text-[var(--accent-green)]" : "bg-red-500/12 text-[var(--accent-red,#FF6B5B)]")}>
              {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}<Sensitive>{signed(portfolio.gain)}</Sensitive> · {pct(portfolio.gainPct)}
            </span>
            <span className="text-muted-foreground">aportado <Sensitive className="tabular-nums text-foreground">{money(portfolio.invested)}</Sensitive></span>
          </div>
          <div className="mt-5 space-y-2.5" aria-label="Aportado frente a valor actual">
            {[["Lo que has aportado", portfolio.invested, "bg-muted-foreground/45"], ["Lo que vale hoy", portfolio.value, "bg-primary"]].map(([label, v, color]) => (
              <div key={label as string}>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>{label as string}</span><Sensitive className="tabular-nums">{money(v as number)}</Sensitive></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all duration-700", color as string)} style={{ width: `${((v as number) / barMax) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          {missingQuotes && <p className="mt-3 text-[11px] text-muted-foreground">Las posiciones sin cotización se cuentan a su precio de compra.</p>}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-4 lg:grid-cols-1">
          <div className={CARD}>
            <p className="page-section-label flex items-center gap-1.5"><PiggyBank className="size-4 text-primary" />Ganancia</p>
            <p className={cn("mt-1 text-xl font-bold tabular-nums sm:text-2xl", tone(portfolio.gain))}><Sensitive>{signed(portfolio.gain)}</Sensitive></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{pct(portfolio.gainPct)} sobre lo aportado</p>
          </div>
          <div className={CARD}>
            <p className="page-section-label flex items-center gap-1.5"><Repeat className="size-4 text-primary" />Aportas al mes</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-primary sm:text-2xl"><Sensitive>{money(portfolio.monthlyPlan)}</Sensitive></p>
            <p className="mt-0.5 text-xs text-muted-foreground">{portfolio.monthlyPlan > 0 ? "Con tus aportaciones periódicas" : "Sin aportación periódica"}</p>
          </div>
        </div>
      </section>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className={CARD}>
          <p className="mb-2 text-sm font-semibold text-foreground">Posiciones</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 text-left font-semibold">Activo</th>
                <th className="hidden px-2 py-2 text-right font-semibold md:table-cell">Coste medio</th>
                <th className="hidden px-2 py-2 text-right font-semibold md:table-cell">Precio</th>
                <th className="px-2 py-2 text-right font-semibold">Valor</th>
                <th className="py-2 pl-2 text-right font-semibold">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-t border-border/60 transition-colors hover:bg-muted/40" onClick={() => setDialog({ open: true, editing: positions.find((p) => p.id === r.id) ?? null })}>
                  <td className="py-3 pr-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CLASS_COLORS[r.assetClass] }} aria-hidden />
                      <div className="min-w-0">
                        <p className="line-clamp-2 break-words font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted-foreground"><Sensitive>{r.units.toLocaleString("es-ES", { maximumFractionDigits: 4 })}</Sensitive> uds.{!r.hasQuote && " · sin cotización"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-2 py-3 text-right tabular-nums text-muted-foreground md:table-cell">{unitPrice(r.avgCost, r.priceCurrency)}</td>
                  <td className="hidden whitespace-nowrap px-2 py-3 text-right tabular-nums text-muted-foreground md:table-cell">{unitPrice(r.price, r.priceCurrency)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right font-semibold tabular-nums"><Sensitive>{money(r.value)}</Sensitive></td>
                  <td className={cn("whitespace-nowrap py-3 pl-2 text-right font-semibold tabular-nums", tone(r.gain))}>
                    <Sensitive>{signed(r.gain)}</Sensitive>
                    <span className="block text-xs font-medium opacity-85">{pct(r.gainPct)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid min-w-0 gap-4">
          <div className={CARD}>
            <p className="text-sm font-semibold text-foreground">Reparto por tipo</p>
            <div className="mt-3 flex items-center gap-5">
              <svg viewBox="0 0 42 42" className="size-28 shrink-0" role="img" aria-label="Reparto de la cartera por tipo de activo">
                <circle cx="21" cy="21" r="15.915" fill="none" stroke="var(--muted)" strokeWidth="6" />
                {ring.map((a) => <circle key={a.assetClass} cx="21" cy="21" r="15.915" fill="none" stroke={CLASS_COLORS[a.assetClass]} strokeWidth="6" strokeDasharray={`${a.pct} ${100 - a.pct}`} strokeDashoffset={a.offset} />)}
              </svg>
              <ul className="min-w-0 space-y-1.5 text-sm">
                {portfolio.allocation.map((a) => (
                  <li key={a.assetClass} className="flex items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: CLASS_COLORS[a.assetClass] }} aria-hidden />
                    <span className="min-w-0 truncate text-foreground">{a.label}</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(a.pct)} %</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className={CARD}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">Aportaciones</p>
              <p className="text-xs text-muted-foreground">12 meses · <Sensitive className="tabular-nums">{money(year12)}</Sensitive></p>
            </div>
            <div className="mt-3 flex h-24 items-end gap-1.5" role="img" aria-label="Aportaciones de los últimos 12 meses">
              {portfolio.months.map((m) => (
                <div key={m.key} className="flex h-full flex-1 items-end" title={`${MONTHS[Number(m.key.slice(5)) - 1]}: ${money(m.amount)}`}>
                  <div className={cn("w-full rounded-t-[5px] rounded-b-[2px]", m.amount > 0 ? "bg-primary/75" : "bg-muted")} style={{ height: m.amount > 0 ? `${Math.max(6, (m.amount / maxMonth) * 100)}%` : "4px" }} />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
              {portfolio.months.filter((_, i) => i % 3 === 0 || i === 11).map((m) => <span key={m.key}>{MONTHS[Number(m.key.slice(5)) - 1]}</span>)}
            </div>
          </div>
        </div>
      </section>
      {dialogEl}
    </div>
  )
}
