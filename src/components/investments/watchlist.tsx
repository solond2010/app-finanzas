"use client"

import { useEffect, useState } from "react"
import { Plus, Search, TrendingDown, TrendingUp, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useInvestments, type WatchItem } from "@/lib/investments"

interface Quote { price: number; currency: string; changePct?: number | null }
interface SearchResult { symbol: string; name: string; type: string }

function Sparkline({ closes, up }: { closes: number[]; up: boolean }) {
  if (closes.length < 2) return <div className="h-9" />
  const min = Math.min(...closes)
  const max = Math.max(...closes)
  const range = max - min || 1
  const w = 100
  const h = 36
  const pts = closes.map((c, i) => `${(i / (closes.length - 1)) * w},${h - ((c - min) / range) * h}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-9 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={up ? "var(--accent-green)" : "var(--accent-red)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function WatchCard({ item, quote, hist, onRemove }: { item: WatchItem; quote?: Quote; hist?: { t: number; c: number }[]; onRemove: () => void }) {
  const changePct = quote?.changePct ?? 0
  const up = changePct >= 0
  const closes = (hist ?? []).map((h) => h.c)
  return (
    <div className="group relative w-[230px] shrink-0 rounded-[16px] border border-border bg-card p-4 transition-colors hover:border-foreground/15">
      <button onClick={onRemove} aria-label="Quitar de la lista" className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"><X className="h-3.5 w-3.5" /></button>
      <div className="flex items-center gap-2.5">
        <span className="gold-badge flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold">{item.symbol.slice(0, 2).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{item.name}</p>
          <p className="truncate text-xs text-muted-foreground">{item.symbol}</p>
        </div>
      </div>
      <div className="mt-3 h-9"><Sparkline closes={closes} up={up} /></div>
      <p className={`mt-2 inline-flex items-center gap-1 text-[11px] font-medium ${up ? "text-emerald-500" : "text-red-500"}`}>
        {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        Tendencia {up ? "alcista" : "bajista"}
      </p>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-base font-bold tabular-nums text-foreground">{quote ? `${quote.price.toFixed(2)} ${quote.currency}` : "—"}</span>
        <span className={`text-xs font-semibold tabular-nums ${up ? "text-emerald-500" : "text-red-500"}`}>{quote?.changePct != null ? `${up ? "+" : ""}${changePct.toFixed(2)}%` : ""}</span>
      </div>
    </div>
  )
}

function WatchlistAddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addWatch } = useInvestments()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])

  useEffect(() => {
    if (!open) return
    /* eslint-disable react-hooks/set-state-in-effect */
    setQuery("")
    setResults([])
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open])

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Añadir a seguimiento</DialogTitle></DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej: Apple, AAPL, Bitcoin…" className="pl-9" autoFocus />
        </div>
        {results.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-border">
            {results.map((r) => (
              <button key={r.symbol} onClick={() => { addWatch({ symbol: r.symbol, name: r.name }); onOpenChange(false) }} className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/60">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">{r.symbol.slice(0, 2)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{r.symbol}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.name}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function WatchlistRow({ leading }: { leading?: React.ReactNode }) {
  const { watchlist, removeWatch } = useInvestments()
  const [quotes, setQuotes] = useState<Record<string, Quote>>({})
  const [hist, setHist] = useState<Record<string, { t: number; c: number }[]>>({})
  const [addOpen, setAddOpen] = useState(false)

  const key = watchlist.map((w) => w.symbol).sort().join(",")
  useEffect(() => {
    const syms = key ? key.split(",") : []
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (syms.length === 0) { setQuotes({}); setHist({}); return }
    let cancelled = false
    const q = encodeURIComponent(syms.join(","))
    fetch(`/api/quote?symbols=${q}`).then((r) => r.json()).then((d: { quotes?: Record<string, Quote> }) => { if (!cancelled) setQuotes(d.quotes ?? {}) }).catch(() => {})
    fetch(`/api/history?symbols=${q}`).then((r) => r.json()).then((d: { history?: Record<string, { t: number; c: number }[]> }) => { if (!cancelled) setHist(d.history ?? {}) }).catch(() => {})
    return () => { cancelled = true }
  }, [key])

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">{leading ? "Cuentas y seguimiento" : "Seguimiento"}</p>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {leading}
        {watchlist.map((w) => (
          <WatchCard key={w.symbol} item={w} quote={quotes[w.symbol]} hist={hist[w.symbol]} onRemove={() => removeWatch(w.symbol)} />
        ))}
        <button
          onClick={() => setAddOpen(true)}
          className="flex w-[120px] shrink-0 flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary"><Plus className="h-4 w-4" /></span>
          <span className="text-xs font-medium">Añadir</span>
        </button>
      </div>
      <WatchlistAddDialog open={addOpen} onOpenChange={setAddOpen} />
    </section>
  )
}
