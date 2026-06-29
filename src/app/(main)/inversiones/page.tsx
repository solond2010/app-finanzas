"use client"

import { useEffect, useMemo, useState } from "react"
import { AreaChart, DonutChart } from "@tremor/react"
import { Plus, TrendingUp, TrendingDown, LineChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "@/lib/store"
import { useInvestments, usePortfolioValue, type Position } from "@/lib/investments"
import { PositionDialog } from "@/components/investments/position-dialog"
import { PositionDetailDialog } from "@/components/investments/position-detail-dialog"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { chartFormatter } from "@/lib/format"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[24px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const DONUT_COLORS = ["blue", "cyan", "indigo", "violet", "sky", "slate", "emerald", "amber"]
const KIND_LABEL: Record<string, string> = { stock: "Bolsa", crypto: "Crypto", fund: "Fondos", custom: "Otros" }
const EVO_TABS = [{ id: "rendimiento", label: "Rendimiento" }, { id: "activos", label: "Activos" }, { id: "tipologia", label: "Tipología" }] as const
const POS_FILTERS = [{ id: "all", label: "Todos" }, { id: "stock", label: "Bolsa" }, { id: "crypto", label: "Crypto" }, { id: "fund", label: "Fondos" }, { id: "custom", label: "Otros" }] as const

export default function InversionesPage() {
  const { state } = useFinance()
  const { remove } = useInvestments()
  const { positions, quotes, loading, value, invested, pnl, pnlPct } = usePortfolioValue()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Position | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [evoTab, setEvoTab] = useState<"rendimiento" | "activos" | "tipologia">("rendimiento")
  const [posFilter, setPosFilter] = useState<"all" | "stock" | "crypto" | "fund" | "custom">("all")
  const [hist, setHist] = useState<Record<string, { t: number; c: number }[]>>({})

  const openNew = () => { setEditing(null); setOpen(true) }
  const detailPosition = positions.find((p) => p.id === detailId) ?? null

  const symbolsKey = useMemo(
    () => [...new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))].sort().join(","),
    [positions]
  )

  useEffect(() => {
    const syms = symbolsKey ? symbolsKey.split(",") : []
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (syms.length === 0) { setHist({}); return }
    let cancelled = false
    fetch(`/api/history?symbols=${encodeURIComponent(syms.join(","))}`)
      .then((r) => r.json())
      .then((d: { history?: Record<string, { t: number; c: number }[]> }) => { if (!cancelled) setHist(d.history ?? {}) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [symbolsKey])

  const series = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }) }
    })
    const maps: Record<string, Record<string, number>> = {}
    for (const [sym, arr] of Object.entries(hist)) {
      const m: Record<string, number> = {}
      for (const pt of arr) {
        const d = new Date(pt.t * 1000)
        m[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = pt.c
      }
      maps[sym] = m
    }
    return months.map(({ key, label }) => {
      let v = 0
      for (const p of positions) {
        if (p.kind === "custom") { v += p.units * p.buyPrice; continue }
        v += p.units * (maps[p.symbol]?.[key] ?? p.buyPrice)
      }
      return { mes: label, Cartera: Math.round(v) }
    })
  }, [hist, positions])
  const seriesHasData = series.some((s) => s.Cartera > 0)

  const rows = useMemo(() => positions.map((p) => {
    const current = p.kind === "custom" ? p.buyPrice : (quotes[p.symbol]?.price ?? p.buyPrice)
    const invested = p.units * p.buyPrice
    const value = p.units * current
    const pl = value - invested
    const plPct = invested > 0 ? (pl / invested) * 100 : 0
    const live = p.kind !== "custom" && quotes[p.symbol] !== undefined
    const changePct = p.kind === "custom" ? null : quotes[p.symbol]?.changePct ?? null
    return { p, value, pl, plPct, live, changePct }
  }), [positions, quotes])

  const baseCurrency = (positions[0]?.currency ?? "EUR") as CurrencyCode

  const activosData = useMemo(
    () => rows.map((r) => ({ name: r.p.name, value: Math.round(r.value) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value).slice(0, 8),
    [rows]
  )
  const tipologiaData = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of rows) { const k = KIND_LABEL[r.p.kind]; m[k] = (m[k] ?? 0) + r.value }
    return Object.entries(m).map(([name, v]) => ({ name, value: Math.round(v) })).filter((d) => d.value > 0)
  }, [rows])
  const filteredRows = useMemo(() => (posFilter === "all" ? rows : rows.filter((r) => r.p.kind === posFilter)), [rows, posFilter])
  const donutFormatter = (v: number) => formatMoney(v, baseCurrency)

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Cartera</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Inversiones</h1>
        </div>
        <Button onClick={openNew} className="gap-1.5 self-start rounded-full sm:self-auto"><Plus className="h-4 w-4" /> Nueva posición</Button>
      </header>

      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LineChart className="h-7 w-7" /></span>
          <h2 className="text-lg font-semibold text-foreground">Empieza tu cartera</h2>
          <p className="max-w-sm text-sm text-muted-foreground">Añade tus fondos indexados, acciones, ETFs o crypto y sigue tu rentabilidad en € y % automáticamente.</p>
          <Button onClick={openNew} className="mt-2 gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Añadir posición</Button>
        </div>
      ) : (
        <>
          {/* Resumen + evolución */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <div className={`${CARD} min-w-0 lg:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="page-section-label">Evolución cartera</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    <Sensitive>{formatMoney(value, baseCurrency)}</Sensitive>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className={cn("inline-flex items-center gap-1 font-semibold", pnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                      {pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <Sensitive>{pnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pnl), baseCurrency)}</Sensitive>
                      <span>({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                    </span>
                    <span className="text-muted-foreground">Invertido: <Sensitive>{formatMoney(invested, baseCurrency)}</Sensitive></span>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
                  {EVO_TABS.map((t) => (
                    <button key={t.id} onClick={() => setEvoTab(t.id)} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold transition-colors", evoTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
                  ))}
                </div>
              </div>
              {evoTab === "rendimiento" && (
                seriesHasData ? (
                  <AreaChart data={series} index="mes" categories={["Cartera"]} colors={["blue"]} valueFormatter={chartFormatter} showLegend={false} showGridLines={false} showYAxis={false} className="mt-4 h-52 sm:h-56" curveType="monotone" showAnimation />
                ) : (
                  <div className="mt-4 flex h-52 items-center justify-center rounded-2xl bg-muted/40 text-sm text-muted-foreground sm:h-56">Cargando evolución…</div>
                )
              )}
              {evoTab === "activos" && (
                <DonutChart data={activosData} category="value" index="name" colors={DONUT_COLORS} valueFormatter={donutFormatter} variant="donut" className="mt-4 h-52 sm:h-56" showAnimation />
              )}
              {evoTab === "tipologia" && (
                <DonutChart data={tipologiaData} category="value" index="name" colors={DONUT_COLORS} valueFormatter={donutFormatter} variant="donut" className="mt-4 h-52 sm:h-56" showAnimation />
              )}
            </div>
            <div className={`${CARD} flex flex-col justify-center`}>
              <p className="page-section-label">Posiciones</p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">{positions.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">{loading ? "Actualizando precios…" : "Precios vía Yahoo (diario)"}</p>
            </div>
          </section>

          {/* Posiciones */}
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">Posiciones</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {POS_FILTERS.map((f) => (
                  <button key={f.id} onClick={() => setPosFilter(f.id)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold transition-colors", posFilter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{f.label}</button>
                ))}
              </div>
            </div>
            {filteredRows.length === 0 && (
              <p className="rounded-[24px] border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Sin posiciones en esta categoría.</p>
            )}
            {filteredRows.map(({ p, value, pl, plPct, live, changePct }) => {
              const account = state.accounts.find((a) => a.id === p.accountId)
              return (
                <button
                  key={p.id}
                  onClick={() => setDetailId(p.id)}
                  className={`${CARD} flex w-full items-center gap-3 text-left transition-colors hover:border-foreground/15 sm:gap-4`}
                >
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
                    <p className="flex items-center justify-end gap-1.5 text-xs font-semibold tabular-nums">
                      {changePct != null && (
                        <span className={changePct >= 0 ? "text-emerald-500" : "text-red-500"}>{changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%</span>
                      )}
                      <span className={pl >= 0 ? "text-emerald-500" : "text-red-500"}>({plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%)</span>
                    </p>
                  </div>
                </button>
              )
            })}
          </section>
        </>
      )}

      <PositionDetailDialog
        position={detailPosition}
        quote={detailPosition && detailPosition.kind !== "custom" ? quotes[detailPosition.symbol] : undefined}
        onOpenChange={(o) => { if (!o) setDetailId(null) }}
        onEdit={(p) => { setDetailId(null); setEditing(p); setOpen(true) }}
        onDelete={(id) => { remove(id); setDetailId(null) }}
      />
      <PositionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
