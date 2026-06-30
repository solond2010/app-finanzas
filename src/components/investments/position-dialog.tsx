"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinance } from "@/lib/store"
import { useInvestments, type AssetKind, type DcaFreq, type Position } from "@/lib/investments"
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

export function PositionDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Position | null }) {
  const { state } = useFinance()
  const { add, update } = useInvestments()
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
  const [dcaAmount, setDcaAmount] = useState("")
  const [dcaFreq, setDcaFreq] = useState<DcaFreq>("monthly")
  const [accountId, setAccountId] = useState("")

  const investAccounts = useMemo(() => {
    const inv = state.accounts.filter((a) => a.tipo === "inversion")
    return inv.length > 0 ? inv : state.accounts
  }, [state.accounts])

  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      setQuery(""); setResults([])
      if (editing) {
        setKind(editing.kind)
        setSelected(editing.kind === "custom" ? null : { symbol: editing.symbol, name: editing.name, isin: editing.isin, currency: editing.currency })
        setCustomName(editing.kind === "custom" ? editing.name : "")
        setCurrency(editing.currency)
        setDate(editing.date)
        setUnits(String(editing.units))
        setBuyPrice(String(editing.buyPrice))
        setDca(editing.dca ?? false)
        setDcaAmount(editing.dcaAmount ? String(editing.dcaAmount) : "")
        setDcaFreq(editing.dcaFreq ?? "monthly")
        setAccountId(editing.accountId ?? investAccounts[0]?.id ?? "")
      } else {
        setKind("stock"); setSelected(null); setCustomName("")
        setCurrency("EUR"); setDate(new Date().toISOString().split("T")[0]); setUnits(""); setBuyPrice("")
        setDca(false); setDcaAmount(""); setDcaFreq("monthly"); setAccountId(investAccounts[0]?.id ?? "")
      }
    })
  }, [open, editing, investAccounts])

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

    const dcaFields = dca && Number(dcaAmount) > 0
      ? { dca: true, dcaAmount: Number(dcaAmount), dcaFreq, dcaLast: editing?.dcaLast ?? date }
      : { dca: false, dcaAmount: undefined, dcaFreq: undefined, dcaLast: undefined }

    let payload: Omit<Position, "id">
    if (kind === "custom") {
      if (!customName.trim()) { toast("Pon un nombre al activo", "error"); return }
      payload = { kind, symbol: editing?.kind === "custom" ? editing.symbol : `custom:${customName.trim().toLowerCase()}`, name: customName.trim(), date, units: u, buyPrice: p, currency, accountId, ...dcaFields }
    } else {
      if (!selected) { toast("Busca y selecciona un activo", "error"); return }
      payload = { kind, symbol: selected.symbol, name: selected.name, isin: selected.isin, date, units: u, buyPrice: p, currency: selected.currency, accountId, ...dcaFields }
    }

    if (editing) {
      update({ ...payload, id: editing.id })
      toast("Posición actualizada", "success")
    } else {
      add(payload)
      toast("Posición añadida", "success")
    }
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Editar posición" : "Nueva posición"}</DialogTitle></DialogHeader>

        {!editing && (
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
        )}

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

        <div className="space-y-2 rounded-2xl border border-border bg-muted/30 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={dca} onChange={(e) => setDca(e.target.checked)} className="rounded border-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Programar aportes (DCA)</span>
          </label>
          {dca && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Aporte ({currency})</label>
                <Input type="number" inputMode="decimal" value={dcaAmount} onChange={(e) => setDcaAmount(e.target.value)} placeholder="Ej: 100" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Frecuencia</label>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1">
                  {(["monthly", "weekly"] as DcaFreq[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDcaFreq(f)}
                      className={cn("rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors", dcaFreq === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                    >
                      {f === "monthly" ? "Mensual" : "Semanal"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground">Registra tus compras periódicas. Desde Inversiones podrás aplicar los aportes vencidos al precio de mercado y se recalculará tu precio medio.</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Cuenta / cartera</label>
          <Select value={accountId} onValueChange={(v) => v && setAccountId(v)} items={Object.fromEntries(investAccounts.map((a) => [a.id, a.banco ? `${a.nombre} · ${a.banco}` : a.nombre]))}>
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
          <Button type="button" size="sm" onClick={handleConfirm}>{editing ? "Guardar" : "Confirmar inversión"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
