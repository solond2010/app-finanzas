"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Search, Trash2 } from "@/components/icons"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFinance } from "@/lib/store"
import { useInvestments, dcaAnchorForDay, defaultAssetClass, ASSET_CLASS_LABELS, type AssetClass, type AssetKind, type DcaFreq, type Position } from "@/lib/investments"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import { localDateKey } from "@/lib/date-utils"
import { convertToEur, type CurrencyCode } from "@/lib/currency"
import { money } from "@/lib/format"

interface SearchResult { symbol: string; name: string; type: string }
interface Selected { symbol: string; name: string; isin?: string; currency: string }

const TABS: { kind: AssetKind; label: string; types: string[] }[] = [
  { kind: "stock", label: "Acciones/ETF", types: ["EQUITY", "ETF"] },
  { kind: "fund", label: "Fondos", types: ["MUTUALFUND"] },
  { kind: "crypto", label: "Crypto", types: ["CRYPTOCURRENCY"] },
  { kind: "custom", label: "Personalizado", types: [] },
]

const KIND_OF_TYPE: Record<string, AssetKind> = { EQUITY: "stock", ETF: "stock", MUTUALFUND: "fund", CRYPTOCURRENCY: "crypto" }
const TYPE_LABEL: Record<string, string> = { EQUITY: "Acción", ETF: "ETF", MUTUALFUND: "Fondo", CRYPTOCURRENCY: "Crypto" }

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/

export function PositionDialog({ open, onOpenChange, editing, defaultAccountId, unassignedByAccount }: { open: boolean; onOpenChange: (o: boolean) => void; editing?: Position | null; defaultAccountId?: string; unassignedByAccount?: Record<string, number> }) {
  const { state } = useFinance()
  const { add, update } = useInvestments()
  const { toast } = useToast()

  const [kind, setKind] = useState<AssetKind>("stock")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchState, setSearchState] = useState<"idle" | "empty" | "error">("idle")
  const [selected, setSelected] = useState<Selected | null>(null)
  const [customName, setCustomName] = useState("")
  const [currency, setCurrency] = useState("EUR")
  const [date, setDate] = useState(() => localDateKey())
  const [preexisting, setPreexisting] = useState(false)
  const [thisMonth, setThisMonth] = useState("")
  const [units, setUnits] = useState("")
  const [buyPrice, setBuyPrice] = useState("")
  const [dca, setDca] = useState(false)
  const [dcaAmount, setDcaAmount] = useState("")
  const [dcaFreq, setDcaFreq] = useState<DcaFreq>("monthly")
  const [dcaDay, setDcaDay] = useState("1")
  const [accountId, setAccountId] = useState("")
  const [warned, setWarned] = useState(false)
  const [assetClass, setAssetClass] = useState<AssetClass>("acciones")

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
        setDcaDay(String(Math.min(28, Number((editing.dcaLast ?? editing.date).slice(8, 10)) || 1)))
        setAccountId(editing.accountId ?? investAccounts[0]?.id ?? "")
        setAssetClass(editing.assetClass ?? defaultAssetClass(editing.kind))
      } else {
        setKind("stock"); setSelected(null); setCustomName("")
        setCurrency("EUR"); setDate(localDateKey()); setUnits(""); setBuyPrice("")
        setDca(false); setDcaAmount(""); setDcaFreq("monthly"); setDcaDay(String(Math.min(28, new Date().getDate()))); setAccountId(defaultAccountId ?? investAccounts[0]?.id ?? "")
        setAssetClass(defaultAssetClass("stock"))
      }
      setWarned(false)
    })
  }, [open, editing, investAccounts, defaultAccountId])

  useEffect(() => {
    // Búsqueda con debounce contra una API externa (sistema externo): uso válido
    // de un efecto.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (kind === "custom" || selected) { setResults([]); setSearchState("idle"); return }
    const q = query.trim()
    if (q.length < 2) { setResults([]); setSearchState("idle"); return }
    const activeTypes = TABS.find((t) => t.kind === kind)?.types ?? []
    setSearching(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    const id = setTimeout(() => {
      fetch(`/api/asset-search?q=${encodeURIComponent(q)}`)
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() })
        .then((d: { results?: SearchResult[] }) => {
          // Se busca en todos los tipos; los de la pestaña activa salen primero.
          const all = (d.results ?? []).filter((r) => KIND_OF_TYPE[r.type])
          const sorted = [...all.filter((r) => activeTypes.includes(r.type)), ...all.filter((r) => !activeTypes.includes(r.type))].slice(0, 8)
          setResults(sorted)
          setSearchState(sorted.length ? "idle" : "empty")
        })
        .catch(() => { setResults([]); setSearchState("error") })
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(id)
  }, [query, kind, selected])

  const pickAsset = async (r: SearchResult) => {
    const isin = ISIN_RE.test(query.trim().toUpperCase()) ? query.trim().toUpperCase() : undefined
    setSelected({ symbol: r.symbol, name: r.name, isin, currency: "EUR" })
    setResults([])
    const k = KIND_OF_TYPE[r.type]
    if (k && k !== kind) { setKind(k); setAssetClass(defaultAssetClass(k)) }
    try {
      const res = await fetch(`/api/quote?symbols=${encodeURIComponent(r.symbol)}`)
      const d = (await res.json()) as { quotes?: Record<string, { price: number; currency: string; name?: string }> }
      const q = d.quotes?.[r.symbol]
      if (q) {
        if (q.name && (!r.name || r.name === r.symbol)) setSelected((prev) => (prev ? { ...prev, name: q.name! } : prev))
        setCurrency(q.currency)
        setSelected((prev) => (prev ? { ...prev, currency: q.currency } : prev))
        if (!buyPrice) setBuyPrice(String(q.price))
      }
    } catch {
      // keep defaults
    }
  }

  // Comprar usa el dinero «sin asignar» de la cuenta: no cambia su saldo.
  const available = !editing && unassignedByAccount ? unassignedByAccount[accountId] : undefined
  const costEur = Number(units) > 0 && Number(buyPrice) > 0 ? convertToEur(Number(units) * Number(buyPrice), (selected?.currency ?? currency) as CurrencyCode) : 0
  const exceeds = available !== undefined && Number.isFinite(costEur) && costEur > available + 0.5

  // Mensual: se ancla al día elegido (sin aportes hacia atrás). Si no cambia
  // nada del plan, se conserva la última aplicación para no repetirla.
  const dcaLastFor = (): string => {
    if (dcaFreq === "weekly") return editing?.dcaLast ?? date
    const day = Math.min(28, Math.max(1, Number(dcaDay) || 1))
    const prev = editing?.dca && editing.dcaFreq !== "weekly" && editing.dcaLast
    if (prev && Number(prev.slice(8, 10)) === day) return prev
    return dcaAnchorForDay(day)
  }

  const freeNow = unassignedByAccount?.[accountId]
  const dcaShort = dca && Number(dcaAmount) > 0 && freeNow !== undefined && convertToEur(Number(dcaAmount), (selected?.currency ?? currency) as CurrencyCode) > freeNow + 0.5

  const handleConfirm = () => {
    const u = Number(units)
    const p = Number(buyPrice)
    if (!u || u <= 0 || !p || p <= 0) { toast("Indica cantidad y precio de compra", "error"); return }
    if (exceeds && !warned) { setWarned(true); return }

    const dcaFields = dca && Number(dcaAmount) > 0
      ? { dca: true, dcaAmount: Number(dcaAmount), dcaFreq, dcaLast: dcaLastFor() }
      : { dca: false, dcaAmount: undefined, dcaFreq: undefined, dcaLast: undefined }

    let payload: Omit<Position, "id">
    if (kind === "custom") {
      if (!customName.trim()) { toast("Pon un nombre al activo", "error"); return }
      payload = { kind, symbol: editing?.kind === "custom" ? editing.symbol : `custom:${customName.trim().toLowerCase()}`, name: customName.trim(), date, units: u, buyPrice: p, currency, accountId, assetClass, ...dcaFields }
    } else {
      if (!selected) { toast("Busca y selecciona un activo", "error"); return }
      payload = { kind, symbol: selected.symbol, name: selected.name, isin: selected.isin, date, units: u, buyPrice: p, currency: selected.currency, accountId, assetClass, ...dcaFields }
    }

    if (editing) {
      if (!update({ ...payload, id: editing.id })) { toast("No se pudo guardar de forma segura: falta espacio para la cola local", "error"); return }
      toast("Posición actualizada", "success")
    } else {
      const tm = Number(thisMonth.replace(",", "."))
      const { merged, saved } = add(payload, preexisting ? { preexisting: true, thisMonth: Number.isFinite(tm) && tm > 0 ? tm : 0, today: localDateKey() } : undefined)
      if (!saved) { toast("No se pudo guardar de forma segura: falta espacio para la cola local", "error"); return }
      toast(merged ? "Sumado a tu posición existente" : "Posición añadida", "success")
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
                onClick={() => { setKind(t.kind); setSelected(null); setQuery(""); setResults([]); setAssetClass(defaultAssetClass(t.kind)) }}
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
                          <span className="block truncate text-sm font-medium text-foreground">{r.name || r.symbol}</span>
                          <span className="block truncate font-mono text-[10px] text-muted-foreground">{r.symbol}</span>
                        </span>
                        <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{TYPE_LABEL[r.type] ?? r.type}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!searching && searchState !== "idle" && results.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border px-3 py-2.5 text-xs text-muted-foreground">
                    {searchState === "error" ? "Ahora mismo no podemos buscar precios." : "No encontramos nada con ese nombre."}{" "}
                    <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setKind("custom"); setAssetClass(defaultAssetClass("custom")); setCustomName(query.trim()) }}>
                      Añádelo a mano
                    </button>{" "}
                    con su nombre y precio.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {!editing && (
          <div className="space-y-2 rounded-xl border border-border bg-background/40 p-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" checked={preexisting} onChange={(e) => setPreexisting(e.target.checked)} className="mt-0.5 size-4 accent-[var(--gold)]" />
              <span className="min-w-0"><span className="block text-sm font-semibold text-foreground">¿Ya la tenías antes?</span><span className="block text-xs text-muted-foreground">Se guarda como posición de partida: no cuenta como aportación ni como gasto de este mes.</span></span>
            </label>
            {preexisting && (
              <div className="space-y-1 pl-6">
                <label className="text-xs text-muted-foreground">Aportas este mes (opcional, €)</label>
                <Input inputMode="decimal" value={thisMonth} onChange={(e) => setThisMonth(e.target.value)} placeholder="0" className="tabular-nums" />
              </div>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">{preexisting ? "Desde cuándo la tienes (aprox.)" : "Fecha de operación"}</label>
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
              {dcaFreq === "monthly" && (
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs text-muted-foreground" htmlFor="dca-day">Día del mes</label>
                  <Input id="dca-day" type="number" inputMode="numeric" min={1} max={28} value={dcaDay} onChange={(e) => setDcaDay(e.target.value)} className="w-24" />
                </div>
              )}
              {dcaShort && <p className="col-span-2 flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Ahora hay {money(freeNow ?? 0)} sin asignar en esta cuenta. El aporte se aplicará igualmente; actualiza el saldo de la cuenta cuando ingreses el dinero.</p>}
              <p className="col-span-2 text-[11px] text-muted-foreground">Cada {dcaFreq === "monthly" ? `mes, el día ${Math.min(28, Math.max(1, Number(dcaDay) || 1))},` : "semana"} se suman participaciones a esta posición con el precio de mercado (o el de compra si no hay cotización), usando el dinero sin asignar de la cuenta. Nunca se aplica dos veces el mismo aporte.</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Clase de activo</label>
          <Select value={assetClass} onValueChange={(v) => v && setAssetClass(v as AssetClass)} items={ASSET_CLASS_LABELS}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.entries(ASSET_CLASS_LABELS) as [AssetClass, string][]).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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

        {available !== undefined && costEur > 0 && (
          <p className={cn("rounded-xl px-3 py-2 text-xs", exceeds ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted/40 text-muted-foreground")} role={exceeds ? "alert" : undefined}>
            {exceeds
              ? `Cuesta ${money(costEur)} y en esta cuenta solo quedan ${money(Math.max(0, available))} sin asignar. Si has metido dinero nuevo, actualiza antes el saldo en Cuentas.`
              : `Usa ${money(costEur)} del dinero sin asignar de la cuenta (quedan ${money(Math.max(0, available - costEur))}). El saldo no cambia.`}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" size="sm" onClick={handleConfirm}>{editing ? "Guardar" : exceeds && warned ? "Añadir igualmente" : "Confirmar inversión"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
