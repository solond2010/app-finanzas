"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinance } from "@/lib/store"
import { useInvestments, type AssetKind } from "@/lib/investments"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

interface SearchResult { symbol: string; name: string; type: string }
interface Selected { symbol: string; name: string; isin?: string; currency: string }

const TABS: { kind: AssetKind; label: string; types: string[] }[] = [
  { kind: "stock", label: "Acciones/ETF", types: ["EQUITY", "ETF"] },
  { kind: "fund", label: "Fondos", types: ["MUTUALFUND"] },
  { kind: "crypto", label: "Crypto", types: ["CRYPTOCURRENCY"] },
  { kind: "custom", label: "Personalizado", types: [] },
]

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/

export function PositionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { state } = useFinance()
  const { add } = useInvestments()
  const { toast } = useToast()

  const [kind, setKind] = useState<AssetKind>("stock")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<Selected | null>(null)
  const [customName, setCustomName] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0])
  const [units, setUnits] = useState("")
  const [buyPrice, setBuyPrice] = useState("")
  const [dca, setDca] = useState(false)
  const [accountId, setAccountId] = useState("")

  const investAccounts = useMemo(() => {
    const inv = state.accounts.filter((a) => a.tipo === "inversion")
    return inv.length > 0 ? inv : state.accounts
  }, [state.accounts])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setKind("stock"); setQuery(""); setResults([]); setSelected(null); setCustomName("")
      setCurrency("EUR"); setDate(new Date().toISOString().split("T")[0]); setUnits(""); setBuyPrice("")
      setDca(false); setAccountId(investAccounts[0]?.id ?? "")
    })
  }, [open, investAccounts])

  useEffect(() => {
    // Búsqueda con debounce contra una API externa (sistema externo): uso válido
    // de un efecto.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (kind === "custom" || selected) { setResults([]); return }
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    const activeTypes = TABS.find((t) => t.kind === kind)?.types ?? []
    setSearching(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    const id = setTimeout(() => {
      fetch(`/api/asset-search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { results?: SearchResult[] }) => {
          const filtered = (d.results ?? []).filter((r) => activeTypes.includes(r.type)).slice(0, 6)
          setResults(filtered)
        })
        .catch(() => setResults([]))
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(id)
  }, [query, kind, selected])

  const pickAsset = async (r: SearchResult) => {
    const isin = ISIN_RE.test(query.trim().toUpperCase()) ? query.trim().toUpperCase() : undefined
    setSelected({ symbol: r.symbol, name: r.name, isin, currency: "EUR" })
    setResults([])
    try {
      const res = await fetch(`/api/quote?symbols=${encodeURIComponent(r.symbol)}`)
      const d = (await res.json()) as { quotes?: Record<string, { price: number; currency: string }> }
      const q = d.quotes?.[r.symbol]
      if (q) {
        setCurrency(q.currency)
        setSelected((prev) => (prev ? { ...prev, currency: q.currency } : prev))
        if (!buyPrice) setBuyPrice(String(q.price))
      }
    } catch {
      // keep defaults
    }
  }

  const handleConfirm = () => {
    const u = Number(units)
    const p = Number(buyPrice)
    if (!u || u <= 0 || !p || p <= 0) { toast("Indica cantidad y precio de compra", "error"); return }

    if (kind === "custom") {
      if (!customName.trim()) { toast("Pon un nombre al activo", "error"); return }
      add({ kind, symbol: `custom:${customName.trim().toLowerCase()}`, name: customName.trim(), date, units: u, buyPrice: p, currency, accountId, dca })
    } else {
      if (!selected) { toast("Busca y selecciona un activo", "error"); return }
      add({ kind, symbol: selected.symbol, name: selected.name, isin: selected.isin, date, units: u, buyPrice: p, currency: selected.currency, accountId, dca })
    }
    toast("Posición añadida", "success")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nueva posición</DialogTitle></DialogHeader>

        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-muted/50 p-1">
          {TABS.map((t) => (
            <button
              key={t.kind}
              onClick={() => { setKind(t.kind); setSelected(null); setQuery(""); setResults([]) }}
              className={cn("rounded-xl px-2 py-2 text-xs font-semibold transition-colors", kind === t.kind ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {kind === "custom" ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Nombre del activo</label>
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Ej: Oro físico" />
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Buscar activo {kind === "fund" && "(nombre o ISIN)"}</label>
            {selected ? (
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary text-xs font-bold">{selected.symbol.slice(0, 2)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{selected.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">{selected.name}</p>
                </div>
                <button onClick={() => { setSelected(null); setQuery("") }} aria-label="Quitar activo" className="text-muted-foreground transition-colors hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={kind === "crypto" ? "Ej: Bitcoin, ETH…" : kind === "fund" ? "Ej: Vanguard, IE00B03HCZ61…" : "Ej: Apple, AAPL…"} className="pl-9" />
                </div>
                {(searching || results.length > 0) && (
                  <div className="overflow-hidden rounded-2xl border border-border">
                    {searching && results.length === 0 && <p className="px-3 py-2 text-xs text-muted-foreground">Buscando…</p>}
                    {results.map((r) => (
                      <button key={r.symbol} onClick={() => pickAsset(r)} className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-muted/60">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[10px] font-bold text-muted-foreground">{r.symbol.slice(0, 2)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{r.symbol}</span>
                          <span className="block truncate text-xs text-muted-foreground">{r.name}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Fecha de operación</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">{kind === "fund" ? "Participaciones" : "Cantidad"}</label>
            <Input type="number" inputMode="decimal" value={units} onChange={(e) => setUnits(e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Precio compra ({currency})</label>
            <Input type="number" inputMode="decimal" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} placeholder="0" />
          </div>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={dca} onChange={(e) => setDca(e.target.checked)} className="rounded border-muted-foreground" />
          <span className="text-sm text-muted-foreground">Programar aportes (DCA)</span>
        </label>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Cuenta / cartera</label>
          <Select value={accountId} onValueChange={(v) => v && setAccountId(v)}>
            <SelectTrigger><SelectValue placeholder="Selecciona cartera" /></SelectTrigger>
            <SelectContent>
              {investAccounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.nombre}{a.banco ? ` · ${a.banco}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" size="sm" onClick={handleConfirm}>Confirmar inversión</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
