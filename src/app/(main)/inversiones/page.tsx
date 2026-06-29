"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, TrendingUp, TrendingDown, Trash2, LineChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "@/lib/store"
import { useInvestments } from "@/lib/investments"
import { PositionDialog } from "@/components/investments/position-dialog"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[24px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"

interface Quote { price: number; currency: string }

export default function InversionesPage() {
  const { state } = useFinance()
  const { positions, remove } = useInvestments()
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  const symbols = useMemo(
    () => [...new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))],
    [positions]
  )

  useEffect(() => {
    // Sincroniza la UI con un sistema externo (precios de mercado). Uso previsto
    // de un efecto: fetch de datos remotos al cambiar las posiciones.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (symbols.length === 0) { setQuotes({}); return }
    let cancelled = false
    setLoading(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    fetch(`/api/quote?symbols=${encodeURIComponent(symbols.join(","))}`)
      .then((r) => r.json())
      .then((d: { quotes?: Record<string, Quote> }) => { if (!cancelled) setQuotes(d.quotes ?? {}) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbols])

  const rows = useMemo(() => positions.map((p) => {
    const current = p.kind === "custom" ? p.buyPrice : (quotes[p.symbol]?.price ?? p.buyPrice)
    const invested = p.units * p.buyPrice
    const value = p.units * current
    const pnl = value - invested
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
    const live = p.kind !== "custom" && quotes[p.symbol] !== undefined
    return { p, current, invested, value, pnl, pnlPct, live }
  }), [positions, quotes])

  const totalInvested = rows.reduce((s, r) => s + r.invested, 0)
  const totalValue = rows.reduce((s, r) => s + r.value, 0)
  const totalPnl = totalValue - totalInvested
  const totalPnlPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const baseCurrency = (rows[0]?.p.currency as CurrencyCode ?? "EUR") as CurrencyCode

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Cartera</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Inversiones</h1>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-1.5 self-start rounded-full sm:self-auto"><Plus className="h-4 w-4" /> Nueva posición</Button>
      </header>

      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LineChart className="h-7 w-7" /></span>
          <h2 className="text-lg font-semibold text-foreground">Empieza tu cartera</h2>
          <p className="max-w-sm text-sm text-muted-foreground">Añade tus fondos indexados, acciones, ETFs o crypto y sigue tu rentabilidad en € y % automáticamente.</p>
          <Button onClick={() => setOpen(true)} className="mt-2 gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Añadir posición</Button>
        </div>
      ) : (
        <>
          {/* Resumen de cartera */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <div className={`${CARD} lg:col-span-2`}>
              <p className="page-section-label">Valor de la cartera</p>
              <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                <Sensitive>{formatMoney(totalValue, baseCurrency)}</Sensitive>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className={cn("inline-flex items-center gap-1 font-semibold", totalPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                  {totalPnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <Sensitive>{totalPnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(totalPnl), baseCurrency)}</Sensitive>
                  <span>({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(2)}%)</span>
                </span>
                <span className="text-muted-foreground">Invertido: <Sensitive>{formatMoney(totalInvested, baseCurrency)}</Sensitive></span>
              </div>
            </div>
            <div className={`${CARD} flex flex-col justify-center`}>
              <p className="page-section-label">Posiciones</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{positions.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{loading ? "Actualizando precios…" : "Precios vía Yahoo (diario)"}</p>
            </div>
          </section>

          {/* Posiciones */}
          <section className="space-y-3">
            {rows.map(({ p, value, pnl, pnlPct, live }) => {
              const account = state.accounts.find((a) => a.id === p.accountId)
              return (
                <div key={p.id} className={`${CARD} flex items-center gap-3 sm:gap-4`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">{p.symbol.replace("custom:", "").slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.units} {p.kind === "fund" ? "part." : "ud."} · <Sensitive>{formatMoney(p.buyPrice, p.currency as CurrencyCode)}</Sensitive>
                      {account ? ` · ${account.nombre}` : ""}
                      {!live && p.kind !== "custom" && " · sin precio"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold tabular-nums text-foreground"><Sensitive>{formatMoney(value, p.currency as CurrencyCode)}</Sensitive></p>
                    <p className={cn("text-xs font-semibold tabular-nums", pnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {pnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pnl), p.currency as CurrencyCode)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                    </p>
                  </div>
                  <button onClick={() => remove(p.id)} aria-label="Eliminar posición" className="shrink-0 text-muted-foreground transition-colors hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              )
            })}
          </section>
        </>
      )}

      <PositionDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}
