"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { CalendarRange, Download, Maximize2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useInvestments, type Position } from "@/lib/investments"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { cn } from "@/lib/utils"

interface Quote { price: number; currency: string; changePct?: number | null }

const CARD = "rounded-[16px] border border-border bg-card p-5 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"
const VISIBLE_MONTHS = 5

const MONTH_LABEL = new Intl.DateTimeFormat("es-ES", { month: "short", year: "numeric" })

function monthKey(dateStr: string) {
  return dateStr.slice(0, 7) // "YYYY-MM"
}

function monthLabel(key: string) {
  const label = MONTH_LABEL.format(new Date(`${key}-02`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Agrupa los aportes por mes y por posición: { "2026-04": { posId: total } }. */
function buildMonthly(contributions: { positionId: string; amount: number; date: string }[]) {
  const byMonth = new Map<string, Map<string, number>>()
  for (const c of contributions) {
    const mk = monthKey(c.date)
    if (!byMonth.has(mk)) byMonth.set(mk, new Map())
    const row = byMonth.get(mk)!
    row.set(c.positionId, (row.get(c.positionId) ?? 0) + c.amount)
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function exportToExcel(months: [string, Map<string, number>][], positions: Position[], totals: { invested: number; value: number; pnl: number }) {
  const header = ["Mes", ...positions.map((p) => p.name), "Total"]
  const rows = months.map(([mk, row]) => {
    const values = positions.map((p) => row.get(p.id) ?? 0)
    const total = values.reduce((s, v) => s + v, 0)
    return [monthLabel(mk), ...values, total]
  })
  rows.push(["Total aportado", ...positions.map((p) => months.reduce((s, [, row]) => s + (row.get(p.id) ?? 0), 0)), totals.invested])
  rows.push(["Valor de mercado actual", ...positions.map(() => ""), totals.value])
  rows.push(["Ganancias", ...positions.map(() => ""), totals.pnl])

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Aportaciones")
  XLSX.writeFile(wb, `aportaciones-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function ContributionsGrid({ months, positions, cur }: { months: [string, Map<string, number>][]; positions: Position[]; cur: CurrencyCode }) {
  const totalsByPosition = positions.map((p) => months.reduce((s, [, row]) => s + (row.get(p.id) ?? 0), 0))
  const grandTotal = totalsByPosition.reduce((s, v) => s + v, 0)

  return (
    <div className="overflow-x-auto rounded-2xl border border-border">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr>
            <td className="p-2.5" />
            {positions.map((p) => (
              <td key={p.id} className="p-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="gold-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold">{p.symbol.replace("custom:", "").slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-semibold text-foreground">{p.name}</p>
                    {p.isin && <p className="truncate text-[10px] text-muted-foreground">{p.isin}</p>}
                  </div>
                </div>
              </td>
            ))}
            <td className="p-2.5 text-right text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Total</td>
          </tr>
        </thead>
        <tbody>
          {months.map(([mk, row], i) => {
            const total = positions.reduce((s, p) => s + (row.get(p.id) ?? 0), 0)
            const isCurrent = i === months.length - 1
            return (
              <tr key={mk} className={cn("border-t border-border", isCurrent && "bg-[color-mix(in_oklch,var(--gold),transparent_94%)]")}>
                <td className={cn("p-2.5 whitespace-nowrap", isCurrent ? "font-bold" : "text-muted-foreground")} style={isCurrent ? { color: "var(--gold)" } : undefined}>{monthLabel(mk)}</td>
                {positions.map((p) => {
                  const v = row.get(p.id)
                  return <td key={p.id} className="p-2.5 text-right tabular-nums">{v ? formatMoney(v, cur) : <span className="text-muted-foreground/50">–</span>}</td>
                })}
                <td className={cn("p-2.5 text-right font-semibold tabular-nums", isCurrent && "text-gold")} style={isCurrent ? { color: "var(--gold)" } : undefined}>{formatMoney(total, cur)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="p-2.5 font-bold">Total aportado</td>
            {totalsByPosition.map((t, i) => <td key={positions[i].id} className="p-2.5 text-right font-bold tabular-nums">{formatMoney(t, cur)}</td>)}
            <td className="p-2.5 text-right font-bold tabular-nums">{formatMoney(grandTotal, cur)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

export function ContributionsTable({ quotes }: { quotes: Record<string, Quote> }) {
  const { positions, contributions, addContribution } = useInvestments()
  const [expanded, setExpanded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addPositionId, setAddPositionId] = useState("")
  const [addAmount, setAddAmount] = useState("")
  const [addDate, setAddDate] = useState(() => new Date().toISOString().slice(0, 10))

  const cur = (positions[0]?.currency ?? "EUR") as CurrencyCode
  const priceOf = (p: Position) => (p.kind === "custom" ? p.buyPrice : quotes[p.symbol]?.price ?? p.buyPrice)

  const allMonths = useMemo(() => buildMonthly(contributions), [contributions])
  const visibleMonths = allMonths.slice(-VISIBLE_MONTHS)

  const invested = positions.reduce((s, p) => s + p.units * p.buyPrice, 0)
  const value = positions.reduce((s, p) => s + p.units * priceOf(p), 0)
  const pnl = value - invested
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0

  if (positions.length === 0) return null

  const handleAdd = () => {
    const amount = parseFloat(addAmount.replace(",", "."))
    if (!addPositionId || !amount || amount <= 0) return
    addContribution(addPositionId, amount, addDate)
    setAddAmount("")
    setAddOpen(false)
  }

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="gold-badge flex h-8 w-8 items-center justify-center rounded-xl"><CalendarRange className="h-4 w-4" /></span>
          <div>
            <p className="page-section-label">Aportaciones mensuales</p>
            <p className="text-xs text-muted-foreground">Histórico de aportes por fondo, mes a mes.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => exportToExcel(allMonths, positions, { invested, value, pnl })}>
            <Download className="h-3.5 w-3.5" /> Excel
          </Button>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => setExpanded(true)}>
            <Maximize2 className="h-3.5 w-3.5" /> Ver todo
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <ContributionsGrid months={visibleMonths} positions={positions} cur={cur} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-muted/30 p-3">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Aportado</p>
          <p className="mt-1 text-base font-bold tabular-nums">{formatMoney(invested, cur)}</p>
        </div>
        <div className="rounded-2xl bg-muted/30 p-3">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Valor actual</p>
          <p className="mt-1 text-base font-bold tabular-nums">{formatMoney(value, cur)}</p>
        </div>
        <div className="rounded-2xl bg-muted/30 p-3">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">Ganancias</p>
          <p className="mt-1 text-base font-bold tabular-nums" style={{ color: pnl >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}>
            {pnl >= 0 ? "+" : ""}{formatMoney(pnl, cur)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
          </p>
        </div>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader className="flex-row items-center justify-between pr-8">
            <div>
              <p className="page-section-label">Histórico completo</p>
              <DialogTitle>Aportaciones mensuales</DialogTitle>
            </div>
            <Button size="sm" className="rounded-full" onClick={() => exportToExcel(allMonths, positions, { invested, value, pnl })}>
              <Download className="h-3.5 w-3.5" /> Descargar Excel
            </Button>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto">
            <ContributionsGrid months={allMonths} positions={positions} cur={cur} />
          </div>
          {!addOpen ? (
            <Button variant="outline" className="rounded-xl border-dashed" onClick={() => { setAddPositionId(positions[0]?.id ?? ""); setAddOpen(true) }}>
              <Plus className="h-3.5 w-3.5" /> Añadir aportación manual
            </Button>
          ) : (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border p-3">
              <div className="min-w-[140px] flex-1">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase">Fondo</p>
                <Select value={addPositionId} onValueChange={(v) => setAddPositionId(v ?? "")} items={Object.fromEntries(positions.map((p) => [p.id, p.name]))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase">Importe</p>
                <Input value={addAmount} onChange={(e) => setAddAmount(e.target.value)} placeholder="100" inputMode="decimal" />
              </div>
              <div className="w-40">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground uppercase">Fecha</p>
                <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} />
              </div>
              <Button size="sm" className="rounded-full" onClick={handleAdd}>Guardar</Button>
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
