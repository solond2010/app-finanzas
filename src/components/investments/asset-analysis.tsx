"use client"

import { useEffect, useMemo, useState } from "react"
import { AreaChart } from "@tremor/react"
import { Search, TrendingDown, TrendingUp, X, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { createChartTooltip } from "@/components/shared/chart-tooltip"
import { cn } from "@/lib/utils"

const CARD = "rounded-[24px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"

interface SearchResult { symbol: string; name: string; type: string }
interface Asset {
  symbol: string; name: string; currency: string; exchange: string; type: string
  price: number; changePct: number | null
  dayHigh: number | null; dayLow: number | null; volume: number | null
  fiftyTwoWeekHigh: number | null; fiftyTwoWeekLow: number | null
  marketCap: number | null; trailingPE: number | null; forwardPE: number | null
  eps: number | null; beta: number | null; priceToBook: number | null; dividendYield: number | null
}

const RANGES = [
  { id: "1mo", label: "1M", interval: "1d" },
  { id: "6mo", label: "6M", interval: "1d" },
  { id: "1y", label: "1A", interval: "1d" },
  { id: "5y", label: "5A", interval: "1wk" },
] as const

function fmtPrice(v: number, currency: string) {
  try {
    return new Intl.NumberFormat("es-ES", { style: "currency", currency, maximumFractionDigits: 2 }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}
function fmtCompact(v: number | null, currency?: string) {
  if (v == null) return "—"
  const abs = Math.abs(v)
  const sfx = abs >= 1e12 ? ["T", 1e12] : abs >= 1e9 ? ["B", 1e9] : abs >= 1e6 ? ["M", 1e6] : abs >= 1e3 ? ["K", 1e3] : ["", 1]
  const num = `${(v / (sfx[1] as number)).toFixed(2)}${sfx[0]}`
  return currency ? `${num} ${currency}` : num
}
function fmtNum(v: number | null, digits = 2) { return v == null ? "—" : v.toFixed(digits) }
function fmtPct(v: number | null) { return v == null ? "—" : `${(v * 100).toFixed(2)}%` }

export function AssetAnalysis() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [symbol, setSymbol] = useState<string | null>(null)
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(false)
  const [hist, setHist] = useState<{ t: number; c: number }[]>([])
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("1y")

  useEffect(() => {
    const q = query.trim()
    /* eslint-disable react-hooks/set-state-in-effect */
    if (q.length < 2) { setResults([]); return }
    /* eslint-enable react-hooks/set-state-in-effect */
    const id = setTimeout(() => {
      fetch(`/api/asset-search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { results?: SearchResult[] }) => setResults((d.results ?? []).slice(0, 7)))
        .catch(() => {})
    }, 350)
    return () => clearTimeout(id)
  }, [query])

  useEffect(() => {
    if (!symbol) return
    let cancelled = false
    setLoading(true)
    fetch(`/api/asset?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d: { asset?: Asset | null }) => { if (!cancelled) setAsset(d.asset ?? null) })
      .catch(() => { if (!cancelled) setAsset(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [symbol])

  useEffect(() => {
    if (!symbol) return
    const r = RANGES.find((x) => x.id === range)!
    let cancelled = false
    fetch(`/api/history?symbols=${encodeURIComponent(symbol)}&interval=${r.interval}&range=${r.id}`)
      .then((res) => res.json())
      .then((d: { history?: Record<string, { t: number; c: number }[]> }) => { if (!cancelled) setHist(d.history?.[symbol] ?? []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [symbol, range])

  const pick = (r: SearchResult) => {
    setSymbol(r.symbol); setQuery(r.name); setOpen(false); setResults([])
  }
  const clear = () => { setSymbol(null); setAsset(null); setHist([]); setQuery("") }

  const up = (asset?.changePct ?? 0) >= 0
  const chartData = hist.map((h) => ({
    fecha: new Date(h.t * 1000).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" }),
    Precio: Number(h.c.toFixed(2)),
  }))
  const cur = asset?.currency ?? "USD"
  const PriceTooltip = useMemo(() => createChartTooltip(["Precio"], [up ? "emerald" : "red"], (v) => fmtPrice(v, cur)), [up, cur])

  const stats: { label: string; value: string }[] = asset
    ? [
        { label: "Cap. mercado", value: fmtCompact(asset.marketCap, cur) },
        { label: "PER (TTM)", value: fmtNum(asset.trailingPE) },
        { label: "PER adelantado", value: fmtNum(asset.forwardPE) },
        { label: "BPA", value: asset.eps == null ? "—" : fmtPrice(asset.eps, cur) },
        { label: "Máx. 52 sem.", value: asset.fiftyTwoWeekHigh == null ? "—" : fmtPrice(asset.fiftyTwoWeekHigh, cur) },
        { label: "Mín. 52 sem.", value: asset.fiftyTwoWeekLow == null ? "—" : fmtPrice(asset.fiftyTwoWeekLow, cur) },
        { label: "Rango día", value: asset.dayLow == null || asset.dayHigh == null ? "—" : `${asset.dayLow.toFixed(2)} – ${asset.dayHigh.toFixed(2)}` },
        { label: "Volumen", value: fmtCompact(asset.volume) },
        { label: "Beta", value: fmtNum(asset.beta) },
        { label: "P/VC", value: fmtNum(asset.priceToBook) },
        { label: "Rent. dividendo", value: fmtPct(asset.dividendYield) },
      ]
    : []

  return (
    <section className={CARD}>
      <p className="page-section-label">Análisis de activos</p>
      <p className="mt-1 mb-4 text-xs text-muted-foreground">Busca cualquier acción, ETF, fondo o crypto y consulta su precio, gráfico y fundamentales.</p>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Ej: Apple, AAPL, Bitcoin, S&P 500…"
          className="pl-9 pr-9"
        />
        {symbol && (
          <button onClick={clear} aria-label="Limpiar" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        )}
        {open && results.length > 0 && (
          <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            {results.map((r) => (
              <button key={r.symbol} onClick={() => pick(r)} className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/60">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">{r.symbol.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{r.symbol}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.name}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando datos…</div>
      )}

      {!loading && symbol && !asset && (
        <p className="mt-6 rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">No se han podido cargar los datos de este activo.</p>
      )}

      {!loading && asset && (
        <div className="mt-5 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">{asset.symbol.slice(0, 2).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-foreground">{asset.name}</p>
                <p className="truncate text-xs text-muted-foreground">{asset.symbol}{asset.exchange ? ` · ${asset.exchange}` : ""}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums text-foreground">{fmtPrice(asset.price, cur)}</p>
              {asset.changePct != null && (
                <p className={cn("inline-flex items-center gap-1 text-sm font-semibold tabular-nums", up ? "text-emerald-500" : "text-red-500")}>
                  {up ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {up ? "+" : ""}{asset.changePct.toFixed(2)}% hoy
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 self-start rounded-full border border-border bg-muted/40 p-1 w-fit">
            {RANGES.map((r) => (
              <button key={r.id} onClick={() => setRange(r.id)} className={cn("rounded-full px-3 py-1 text-xs font-semibold transition-colors", range === r.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{r.label}</button>
            ))}
          </div>

          {chartData.length > 1 ? (
            <AreaChart data={chartData} index="fecha" categories={["Precio"]} colors={[up ? "emerald" : "red"]} valueFormatter={(v) => fmtPrice(v, cur)} showLegend={false} showGridLines={false} showYAxis={false} startEndOnly customTooltip={PriceTooltip} className="h-56" curveType="monotone" showAnimation />
          ) : (
            <div className="flex h-56 items-center justify-center rounded-2xl bg-muted/40 text-sm text-muted-foreground">Sin datos de gráfico</div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">Datos vía Yahoo Finance. Algunos fundamentales pueden no estar disponibles para todos los activos.</p>
        </div>
      )}
    </section>
  )
}
