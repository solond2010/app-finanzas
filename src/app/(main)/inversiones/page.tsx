"use client"

import { useEffect, useMemo, useState } from "react"
import { AreaChart, DonutChart } from "@tremor/react"
import { Plus, TrendingUp, TrendingDown, LineChart, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "@/lib/store"
import { useInvestments, usePortfolioValue, type Position } from "@/lib/investments"
import { PositionDialog } from "@/components/investments/position-dialog"
import { PositionDetailPanel } from "@/components/investments/position-detail-panel"
import { WatchlistRow } from "@/components/investments/watchlist"
import { AccountCards } from "@/components/investments/account-cards"
import { ProjectionSimulator } from "@/components/investments/projection"
import { AssetAnalysis } from "@/components/investments/asset-analysis"
import { DcaPanel } from "@/components/investments/dca-panel"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { chartFormatter } from "@/lib/format"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[24px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const DONUT_COLORS = ["blue", "cyan", "indigo", "violet", "sky", "slate", "emerald", "amber"]
const KIND_LABEL: Record<string, string> = { stock: "Bolsa", crypto: "Crypto", fund: "Fondos", custom: "Otros" }
const EVO_TABS = [{ id: "rendimiento", label: "Rendimiento" }, { id: "activos", label: "Activos" }, { id: "tipologia", label: "Tipología" }] as const
const POS_FILTERS = [{ id: "all", label: "Todos" }, { id: "stock", label: "Bolsa" }, { id: "crypto", label: "Crypto" }, { id: "fund", label: "Fondos" }, { id: "custom", label: "Otros" }] as const
const RANGES = [
  { id: "1D", interval: "1d", range: "5d", slice: 5 },
  { id: "1W", interval: "1d", range: "1mo", slice: 7 },
  { id: "1M", interval: "1d", range: "1mo", slice: 0 },
  { id: "1Y", interval: "1mo", range: "1y", slice: 0 },
] as const
type RangeId = (typeof RANGES)[number]["id"]

type HistMap = Record<string, { t: number; c: number }[]>

function buildSeries(poss: Position[], hist: HistMap, isMonthly: boolean, slice: number) {
  const tsSet = new Set<number>()
  for (const p of poss) for (const pt of hist[p.symbol] ?? []) tsSet.add(pt.t)
  const allTs = [...tsSet].sort((a, b) => a - b)
  const out = allTs.map((ts) => {
    let v = 0
    for (const p of poss) {
      if (p.kind === "custom") { v += p.units * p.buyPrice; continue }
      const arr = hist[p.symbol]
      let c = p.buyPrice
      if (arr) for (let i = arr.length - 1; i >= 0; i--) { if (arr[i].t <= ts) { c = arr[i].c; break } }
      v += p.units * c
    }
    const d = new Date(ts * 1000)
    const label = isMonthly
      ? d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
      : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })
    return { mes: label, Cartera: Math.round(v) }
  })
  return slice > 0 ? out.slice(-slice) : out
}

export default function InversionesPage() {
  const { state } = useFinance()
  const { remove } = useInvestments()
  const { positions, quotes, loading, value, invested, pnl, pnlPct, valueByAccount } = usePortfolioValue()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Position | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [evoTab, setEvoTab] = useState<"rendimiento" | "activos" | "tipologia">("rendimiento")
  const [evoRange, setEvoRange] = useState<RangeId>("1Y")
  const [posFilter, setPosFilter] = useState<"all" | "stock" | "crypto" | "fund" | "custom">("all")
  const [posView, setPosView] = useState<"daily" | "total">("daily")
  const [hist, setHist] = useState<HistMap>({})
  const [exporting, setExporting] = useState(false)

  const openNew = () => { setEditing(null); setOpen(true) }
  const detailPosition = positions.find((p) => p.id === detailId) ?? null
  const investAccounts = useMemo(() => state.accounts.filter((a) => a.tipo === "inversion"), [state.accounts])

  const symbolsKey = useMemo(
    () => [...new Set(positions.filter((p) => p.kind !== "custom").map((p) => p.symbol))].sort().join(","),
    [positions]
  )

  useEffect(() => {
    const syms = symbolsKey ? symbolsKey.split(",") : []
    const r = RANGES.find((x) => x.id === evoRange)!
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (syms.length === 0) { setHist({}); return }
    let cancelled = false
    fetch(`/api/history?symbols=${encodeURIComponent(syms.join(","))}&interval=${r.interval}&range=${r.range}`)
      .then((res) => res.json())
      .then((d: { history?: HistMap }) => { if (!cancelled) setHist(d.history ?? {}) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [symbolsKey, evoRange])

  const isMonthly = evoRange === "1Y"
  const sliceN = RANGES.find((x) => x.id === evoRange)!.slice
  const series = useMemo(() => buildSeries(positions, hist, isMonthly, sliceN), [positions, hist, isMonthly, sliceN])
  const assetSeries = useMemo(
    () => (detailPosition && detailPosition.kind !== "custom" ? buildSeries([detailPosition], hist, isMonthly, sliceN) : []),
    [detailPosition, hist, isMonthly, sliceN]
  )
  const shownSeries = detailPosition ? assetSeries : series
  const seriesHasData = shownSeries.some((s) => s.Cartera > 0)

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
  const ahorros0 = state.accounts.filter((a) => a.tipo === "ahorro").reduce((s, a) => s + a.saldo, 0)

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

  const exportXray = async () => {
    setExporting(true)
    try {
      const { generateXrayPdf } = await import("@/lib/xray-pdf")
      generateXrayPdf({
        owner: "Mohamed",
        currency: baseCurrency,
        value, invested, pnl, pnlPct,
        byType: tipologiaData,
        positions: rows.map((r) => ({
          name: r.p.name,
          kind: KIND_LABEL[r.p.kind] ?? "Otros",
          account: state.accounts.find((a) => a.id === r.p.accountId)?.nombre ?? "—",
          units: r.p.units,
          buyPrice: r.p.buyPrice,
          current: r.p.units ? r.value / r.p.units : r.p.buyPrice,
          value: r.value,
          pl: r.pl,
          plPct: r.plPct,
        })),
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="w-full max-w-full space-y-5 overflow-x-hidden sm:space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Cartera</p>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Inversiones</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Portfolio y análisis de activos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Button onClick={openNew} className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Añadir inversión</Button>
          {positions.length > 0 && (
            <Button onClick={exportXray} disabled={exporting} variant="outline" className="gap-1.5 rounded-full">
              <FileDown className="h-4 w-4" /> {exporting ? "Generando…" : "Descargar X-Ray PDF"}
            </Button>
          )}
        </div>
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
          {/* Fila superior: cuentas + seguimiento */}
          <WatchlistRow leading={<AccountCards accounts={investAccounts} valueByAccount={valueByAccount} />} />

          {/* Evolución (izq) + Posiciones / Detalle (der) */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <div className={`${CARD} min-w-0 lg:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="page-section-label">{detailPosition ? `Rendimiento · ${detailPosition.name}` : "Evolución cartera"}</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-foreground sm:text-4xl">
                    <Sensitive>{formatMoney(detailPosition ? detailPosition.units * (detailPosition.kind === "custom" ? detailPosition.buyPrice : quotes[detailPosition.symbol]?.price ?? detailPosition.buyPrice) : value, baseCurrency)}</Sensitive>
                  </p>
                  {!detailPosition && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className={cn("inline-flex items-center gap-1 font-semibold", pnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                        {pnl >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <Sensitive>{pnl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pnl), baseCurrency)}</Sensitive>
                        <span>({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)</span>
                      </span>
                      <span className="text-muted-foreground">Invertido: <Sensitive>{formatMoney(invested, baseCurrency)}</Sensitive></span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1">
                  {EVO_TABS.map((t) => (
                    <button key={t.id} onClick={() => setEvoTab(t.id)} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold transition-colors", evoTab === t.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
                  ))}
                </div>
              </div>

              {evoTab === "rendimiento" && (
                <div className="mt-3 flex items-center gap-1 rounded-full border border-border bg-muted/40 p-1 w-fit">
                  {RANGES.map((r) => (
                    <button key={r.id} onClick={() => setEvoRange(r.id)} className={cn("rounded-full px-2.5 py-1 text-xs font-semibold transition-colors", evoRange === r.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r.id}</button>
                  ))}
                </div>
              )}

              {evoTab === "rendimiento" && (
                seriesHasData ? (
                  <AreaChart data={shownSeries} index="mes" categories={["Cartera"]} colors={["blue"]} valueFormatter={chartFormatter} showLegend={false} showGridLines={false} showYAxis={false} className="mt-4 h-52 sm:h-56" curveType="monotone" showAnimation />
                ) : (
                  <div className="mt-4 flex h-52 items-center justify-center rounded-2xl bg-muted/40 text-center text-sm text-muted-foreground sm:h-56">Sin histórico suficiente para mostrar la evolución.</div>
                )
              )}
              {evoTab === "activos" && (
                <DonutChart data={activosData} category="value" index="name" colors={DONUT_COLORS} valueFormatter={donutFormatter} variant="donut" className="mt-4 h-52 sm:h-56" showAnimation />
              )}
              {evoTab === "tipologia" && (
                <DonutChart data={tipologiaData} category="value" index="name" colors={DONUT_COLORS} valueFormatter={donutFormatter} variant="donut" className="mt-4 h-52 sm:h-56" showAnimation />
              )}
            </div>

            {/* Columna derecha: detalle inline o lista de posiciones */}
            <div className={`${CARD} min-w-0`}>
              {detailPosition ? (
                <PositionDetailPanel
                  position={detailPosition}
                  quote={detailPosition.kind !== "custom" ? quotes[detailPosition.symbol] : undefined}
                  onBack={() => setDetailId(null)}
                  onEdit={(p) => { setDetailId(null); setEditing(p); setOpen(true) }}
                  onDelete={(id) => { remove(id); setDetailId(null) }}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Posiciones</p>
                    <div className="flex items-center gap-1 rounded-full border border-border bg-muted/40 p-0.5 text-[11px] font-semibold">
                      <button onClick={() => setPosView("daily")} className={cn("rounded-full px-2 py-0.5 transition-colors", posView === "daily" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Diario %</button>
                      <button onClick={() => setPosView("total")} className={cn("rounded-full px-2 py-0.5 transition-colors", posView === "total" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>Total</button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {POS_FILTERS.map((f) => (
                      <button key={f.id} onClick={() => setPosFilter(f.id)} className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors", posFilter === f.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{f.label}</button>
                    ))}
                  </div>
                  <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                    {filteredRows.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">Sin posiciones en esta categoría.</p>
                    )}
                    {filteredRows.map(({ p, value, plPct, pl, live, changePct }) => (
                      <button
                        key={p.id}
                        onClick={() => setDetailId(p.id)}
                        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors hover:border-foreground/15"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{p.symbol.replace("custom:", "").slice(0, 2).toUpperCase()}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground"><Sensitive>{formatMoney(value, p.currency as CurrencyCode)}</Sensitive>{!live && p.kind !== "custom" && " · sin precio"}</p>
                        </div>
                        <span className={cn("shrink-0 text-xs font-bold tabular-nums",
                          (posView === "daily" ? (changePct ?? 0) : plPct) >= 0 ? "text-emerald-500" : "text-red-500")}>
                          {posView === "daily"
                            ? (changePct == null ? "—" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`)
                            : `${plPct >= 0 ? "+" : ""}${plPct.toFixed(2)}%`}
                          {posView === "total" && <span className="ml-1 font-normal text-muted-foreground">({pl >= 0 ? "+" : "−"}{formatMoney(Math.abs(pl), p.currency as CurrencyCode)})</span>}
                        </span>
                      </button>
                    ))}
                    <p className="pt-1 text-center text-[11px] text-muted-foreground">{loading ? "Actualizando precios…" : "Precios vía Yahoo (diario)"}</p>
                  </div>
                </>
              )}
            </div>
          </section>

          <DcaPanel quotes={quotes} />
        </>
      )}

      <AssetAnalysis />

      <ProjectionSimulator ahorros0={ahorros0} inversiones0={value} />

      <PositionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
