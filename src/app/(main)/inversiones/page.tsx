"use client"

import { useEffect, useMemo, useState } from "react"
import { DonutChart } from "@tremor/react"
import { Plus, TrendingUp, TrendingDown, LineChart, FileDown, Target, Pencil, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useFinance } from "@/lib/store"
import { useInvestments, usePortfolioValue, assetClassOf, ASSET_CLASS_LABELS, accountDisplayValue, type Position } from "@/lib/investments"
import { PositionDialog } from "@/components/investments/position-dialog"
import { PositionDetailPanel } from "@/components/investments/position-detail-panel"
import { WatchlistRow } from "@/components/investments/watchlist"
import { AccountCards } from "@/components/investments/account-cards"
import { ProjectionSimulator } from "@/components/investments/projection"
import { AssetAnalysis } from "@/components/investments/asset-analysis"
import { DcaPanel } from "@/components/investments/dca-panel"
import { ContributionsTable } from "@/components/investments/contributions-table"
import { MountainChart } from "@/components/shared/mountain-chart"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { EmptyState } from "@/components/shared/empty-state"
import { TickerTile } from "@/components/shared/ticker-tile"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { chartFormatter, isInitialBalanceTransaction } from "@/lib/format"
import { getMonthTotalsByString, getMonthlyInvestmentInflow, getNetWorthAtMonth } from "@/lib/calculations"
import { getSetting, setSetting } from "@/lib/settings"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const CARD = "rounded-[16px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
// Card de evolución de cartera: la cifra más importante de la página, con el
// mismo tinte azul-marino que el hero de patrimonio del Dashboard.
const CARD_HERO = "rounded-[16px] hero-panel p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const DONUT_COLORS = ["blue", "cyan", "indigo", "violet", "sky", "slate", "emerald", "amber"]
// Mismos colores que DONUT_COLORS pero en hex, para la barra segmentada de
// "Por clase de activo" (no usa un componente de Tremor, así que no puede
// resolver los nombres de color por clase CSS).
const CLASS_HEX = ["var(--accent-blue)", "#06b6d4", "#6366f1", "var(--accent-violet)", "#0ea5e9", "var(--muted-foreground)", "var(--accent-green)", "var(--accent-amber)"]
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
  const { positions, quotes, loading, value, invested, pnl, pnlPct, valueByAccount, investedByAccount } = usePortfolioValue()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Position | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [evoTab, setEvoTab] = useState<"rendimiento" | "activos" | "tipologia">("rendimiento")
  const [evoRange, setEvoRange] = useState<RangeId>("1Y")
  const [posFilter, setPosFilter] = useState<"all" | "stock" | "crypto" | "fund" | "custom">("all")
  const [posView, setPosView] = useState<"daily" | "total">("daily")
  const [hist, setHist] = useState<HistMap>({})
  const [exporting, setExporting] = useState(false)
  const [netWorthTarget, setNetWorthTarget] = useState(0)
  const [xrayMonthOffset, setXrayMonthOffset] = useState(0)

  useEffect(() => {
    queueMicrotask(async () => {
      const local = Number(localStorage.getItem("networth-target"))
      if (local > 0) setNetWorthTarget(local)
      const remote = Number(await getSetting("networth-target"))
      if (remote > 0) { setNetWorthTarget(remote); try { localStorage.setItem("networth-target", String(remote)) } catch {} }
    })
  }, [])

  const editNetWorthTarget = () => {
    const v = window.prompt("Objetivo de patrimonio total (€)", String(netWorthTarget || ""))
    if (v == null) return
    const n = Number(v)
    if (n >= 0) {
      setNetWorthTarget(n)
      try { localStorage.setItem("networth-target", String(n)) } catch {}
      setSetting("networth-target", String(n))
    }
  }

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
    for (const r of rows) { const k = ASSET_CLASS_LABELS[assetClassOf(r.p)]; m[k] = (m[k] ?? 0) + r.value }
    return Object.entries(m).map(([name, v]) => ({ name, value: Math.round(v) })).filter((d) => d.value > 0)
  }, [rows])
  const filteredRows = useMemo(() => (posFilter === "all" ? rows : rows.filter((r) => r.p.kind === posFilter)), [rows, posFilter])
  const donutFormatter = (v: number) => formatMoney(v, baseCurrency)
  // Los nombres de cada donut son dinámicos (posiciones/clases de activo reales),
  // así que el tooltip oscuro se construye aquí en vez de como constante de
  // módulo — igual que ya se hace en Analíticas para el donut necesidades/deseos.
  const activosTooltip = useMemo(() => createChartTooltip(activosData.map((d) => d.name), DONUT_COLORS, donutFormatter), [activosData]) // eslint-disable-line react-hooks/exhaustive-deps
  const tipologiaTooltip = useMemo(() => createChartTooltip(tipologiaData.map((d) => d.name), DONUT_COLORS, donutFormatter), [tipologiaData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Mejor posición en cartera (mayor % de rentabilidad), para el ticker superior.
  const bestPosition = useMemo(() => (rows.length === 0 ? null : rows.slice().sort((a, b) => b.plPct - a.plPct)[0]), [rows])

  const tipologiaTotal = tipologiaData.reduce((s, d) => s + d.value, 0) || 1

  // Patrimonio completo del informe: cuentas (liquidez) + cartera de inversión.
  // El donut "Tipología" de la página se queda solo con la cartera; el informe
  // X-Ray añade la liquidez de las cuentas no-inversión como clase aparte.
  const liquidezCuentas = useMemo(() => state.accounts.filter((a) => a.tipo !== "inversion").reduce((s, a) => s + a.saldo, 0), [state.accounts])
  const netWorth = liquidezCuentas + value
  const byTypeForReport = useMemo(() => {
    const m: Record<string, number> = {}
    for (const d of tipologiaData) m[d.name] = d.value
    if (liquidezCuentas > 0) m["Liquidez"] = (m["Liquidez"] ?? 0) + liquidezCuentas
    return Object.entries(m).map(([name, v]) => ({ name, value: Math.round(v) })).filter((d) => d.value > 0)
  }, [tipologiaData, liquidezCuentas])

  // El informe puede exportarse para cualquiera de los últimos 6 meses (mismo
  // rango que el gráfico de evolución), no solo el mes en curso.
  const MAX_XRAY_MONTH_OFFSET = 5
  const xraySelectedDate = useMemo(() => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - xrayMonthOffset); return d }, [xrayMonthOffset])
  const xrayMonthKey = useMemo(() => `${xraySelectedDate.getFullYear()}-${String(xraySelectedDate.getMonth() + 1).padStart(2, "0")}`, [xraySelectedDate])
  const xrayMonthLabel = useMemo(() => xraySelectedDate.toLocaleDateString("es-ES", { month: "long", year: "numeric" }), [xraySelectedDate])
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const xrayMonthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, xrayMonthKey), [analysisTransactions, xrayMonthKey])
  const xrayInvestmentInflow = useMemo(() => getMonthlyInvestmentInflow(analysisTransactions, state.accounts, xrayMonthKey), [analysisTransactions, state.accounts, xrayMonthKey])

  // Evolución del patrimonio (6 meses) para el gráfico del informe: mismo cálculo
  // que el Dashboard (cuentas históricas - saldo bruto de inversión + valor
  // real de esas cuentas hoy, que no se reconstruye retroactivamente).
  const investmentAccounts = useMemo(() => state.accounts.filter((a) => a.tipo === "inversion"), [state.accounts])
  const investmentAccountSaldo = useMemo(() => investmentAccounts.reduce((s, a) => s + a.saldo, 0), [investmentAccounts])
  const investmentDisplayTotal = useMemo(
    () => investmentAccounts.reduce((s, a) => s + accountDisplayValue(a, valueByAccount, investedByAccount), 0),
    [investmentAccounts, valueByAccount, investedByAccount]
  )
  const netWorthTrend = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const offset = 5 - i
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - offset)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" })
    return { label, value: Math.round(getNetWorthAtMonth(state.accounts, state.transactions, key) - investmentAccountSaldo + investmentDisplayTotal) }
  }), [state.accounts, state.transactions, investmentAccountSaldo, investmentDisplayTotal])
  // Patrimonio a cierre del mes elegido para el informe: mismo cálculo que el
  // histórico de arriba (para el mes actual coincide con `netWorth`).
  const xrayNetWorth = useMemo(
    () => xrayMonthOffset === 0 ? netWorth : Math.round(getNetWorthAtMonth(state.accounts, state.transactions, xrayMonthKey) - investmentAccountSaldo + investmentDisplayTotal),
    [xrayMonthOffset, netWorth, state.accounts, state.transactions, xrayMonthKey, investmentAccountSaldo, investmentDisplayTotal]
  )

  const exportXray = async () => {
    setExporting(true)
    try {
      const { generateXrayPdf } = await import("@/lib/xray-pdf")
      generateXrayPdf({
        owner: "Mohamed",
        currency: baseCurrency,
        month: xrayMonthLabel,
        netWorth: xrayNetWorth, netWorthTarget,
        ingresos: xrayMonthTotals.ingresos, gastos: xrayMonthTotals.gastos, investmentInflow: xrayInvestmentInflow,
        value, invested, pnl, pnlPct,
        byType: byTypeForReport,
        netWorthTrend,
        positions: rows.map((r) => ({
          name: r.p.name,
          kind: ASSET_CLASS_LABELS[assetClassOf(r.p)],
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
    <div className="content-fade w-full max-w-full space-y-6 overflow-x-hidden sm:space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-section-label">Cartera</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Inversiones</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Portfolio y análisis de activos</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button onClick={editNetWorthTarget} className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            <Target className="h-3.5 w-3.5 text-primary" />
            {netWorthTarget > 0 ? <>Objetivo: <Sensitive>{formatMoney(netWorthTarget, "EUR")}</Sensitive></> : "Definir objetivo de patrimonio"}
            <Pencil className="h-3 w-3" />
          </button>
          <Button onClick={openNew} className="gap-1.5 rounded-full"><Plus className="h-4 w-4" /> Añadir inversión</Button>
          {positions.length > 0 && (
            <>
              <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1" title="Mes del informe X-Ray">
                <button onClick={() => setXrayMonthOffset((o) => Math.min(MAX_XRAY_MONTH_OFFSET, o + 1))} disabled={xrayMonthOffset >= MAX_XRAY_MONTH_OFFSET} aria-label="Mes anterior del informe" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none">
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="w-24 text-center text-xs font-medium capitalize text-foreground">{xrayMonthLabel}</span>
                <button onClick={() => setXrayMonthOffset((o) => Math.max(0, o - 1))} disabled={xrayMonthOffset <= 0} aria-label="Mes siguiente del informe" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:pointer-events-none">
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <Button onClick={exportXray} disabled={exporting} variant="outline" className="gap-1.5 rounded-full">
                <FileDown className="h-4 w-4" /> {exporting ? "Generando…" : "Descargar X-Ray PDF"}
              </Button>
            </>
          )}
        </div>
      </header>

      {positions.length === 0 ? (
        <EmptyState
          className="py-20"
          icon={LineChart}
          tone="primary"
          title="Empieza tu cartera"
          description="Añade tus fondos indexados, acciones, ETFs o crypto y sigue tu rentabilidad en € y % automáticamente."
          action={{ label: "Añadir posición", icon: Plus, onClick: openNew }}
        />
      ) : (
        <>
          {/* Ticker: pulso de la cartera */}
          <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <TickerTile label="Valor cartera" value={formatMoney(value, baseCurrency)} />
            <TickerTile label="Rentabilidad" value={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`} valueColor={pnlPct >= 0 ? "var(--accent-green)" : "var(--accent-red)"} />
            <TickerTile label="Invertido" value={formatMoney(invested, baseCurrency)} />
            <TickerTile label="Mejor posición" value={bestPosition ? bestPosition.p.name : "—"} suffix={bestPosition ? `${bestPosition.plPct >= 0 ? "+" : ""}${bestPosition.plPct.toFixed(2)}%` : undefined} valueColor="var(--gold)" />
          </section>

          {/* Fila superior: cuentas + seguimiento */}
          <WatchlistRow leading={<AccountCards accounts={investAccounts} valueByAccount={valueByAccount} investedByAccount={investedByAccount} />} />

          {/* Evolución (izq) + Posiciones / Detalle (der) */}
          <section className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            <div className={`${CARD_HERO} min-w-0 lg:col-span-2`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="page-section-label">{detailPosition ? `Rendimiento · ${detailPosition.name}` : "Evolución cartera"}</p>
                  <p className="hero-figure mt-2 text-3xl font-bold tabular-nums tracking-tight sm:text-4xl">
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
                <div className="range-tabs mt-3 w-fit">
                  {RANGES.map((r) => (
                    <button key={r.id} onClick={() => setEvoRange(r.id)} data-active={evoRange === r.id} className="range-tab">{r.id}</button>
                  ))}
                </div>
              )}

              {evoTab === "rendimiento" && (
                seriesHasData ? (
                  <MountainChart data={shownSeries} index="mes" category="Cartera" valueFormatter={chartFormatter} className="mt-4 h-52 sm:h-56" />
                ) : (
                  <div className="mt-4 flex h-52 items-center justify-center rounded-2xl bg-muted/40 text-center text-sm text-muted-foreground sm:h-56">Sin histórico suficiente para mostrar la evolución.</div>
                )
              )}
              {evoTab === "activos" && (
                <DonutChart data={activosData} category="value" index="name" colors={DONUT_COLORS} valueFormatter={donutFormatter} variant="donut" customTooltip={activosTooltip} className="mt-4 h-52 sm:h-56" showAnimation />
              )}
              {evoTab === "tipologia" && (
                <DonutChart data={tipologiaData} category="value" index="name" colors={DONUT_COLORS} valueFormatter={donutFormatter} variant="donut" customTooltip={tipologiaTooltip} className="mt-4 h-52 sm:h-56" showAnimation />
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

          {/* Por clase de activo: mismo patrón que "Composición del patrimonio"
              del Dashboard, siempre visible (la pestaña "Tipología" de arriba
              se queda igual para quien prefiera el donut). */}
          {tipologiaData.length > 0 && (
            <div className={`${CARD} min-w-0`}>
              <p className="text-sm font-semibold text-foreground">Por clase de activo</p>
              <div className="mt-5 flex h-2.5 w-full overflow-hidden rounded-full">
                {tipologiaData.map((d, i) => (
                  <div key={d.name} style={{ width: `${(d.value / tipologiaTotal) * 100}%`, backgroundColor: CLASS_HEX[i % CLASS_HEX.length] }} title={d.name} />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {tipologiaData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: CLASS_HEX[i % CLASS_HEX.length] }} />
                    <span className="text-foreground">{d.name}</span>
                    <span className="tabular-nums text-muted-foreground">{Math.round((d.value / tipologiaTotal) * 100)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DcaPanel quotes={quotes} />

          <ContributionsTable quotes={quotes} />
        </>
      )}

      <AssetAnalysis />

      <ProjectionSimulator ahorros0={ahorros0} inversiones0={value} />

      <PositionDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  )
}
