"use client"

import { Pencil, Trash2, TrendingDown, TrendingUp } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useFinance } from "@/lib/store"
import { type Position } from "@/lib/investments"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

interface Quote { price: number; changePct?: number | null }

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-bold tabular-nums", tone === "up" ? "text-emerald-500" : tone === "down" ? "text-red-500" : "text-foreground")}>{value}</p>
    </div>
  )
}

export function PositionDetailDialog({
  position, quote, onOpenChange, onEdit, onDelete,
}: {
  position: Position | null
  quote?: Quote
  onOpenChange: (open: boolean) => void
  onEdit: (p: Position) => void
  onDelete: (id: string) => void
}) {
  const { state } = useFinance()
  if (!position) return null

  const cur = position.currency as CurrencyCode
  const isCustom = position.kind === "custom"
  const price = isCustom ? position.buyPrice : quote?.price ?? position.buyPrice
  const changePct = isCustom ? 0 : quote?.changePct ?? 0
  const value = position.units * price
  const invested = position.units * position.buyPrice
  const pnl = value - invested
  const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0
  const dayChange = value - value / (1 + changePct / 100)
  const account = state.accounts.find((a) => a.id === position.accountId)

  return (
    <Dialog open={!!position} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 pr-8">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">{position.symbol.replace("custom:", "").slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0">
              <span className="block truncate text-base">{position.name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">{position.isin ?? position.symbol}</span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Valor actual de la posición</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground"><Sensitive>{formatMoney(value, cur)}</Sensitive></p>
            {!isCustom && (
              <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", changePct >= 0 ? "text-emerald-500" : "text-red-500")}>
                {changePct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <Sensitive>{changePct >= 0 ? "+" : "−"}{formatMoney(Math.abs(dayChange), cur)}</Sensitive> <span className="text-muted-foreground">hoy</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cuenta asociada</span>
          <span className="text-sm font-semibold text-primary">{account?.nombre ?? "—"}</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Precio mercado" value={<Sensitive>{formatMoney(price, cur)}</Sensitive>} />
          <Metric label="Precio medio" value={<Sensitive>{formatMoney(position.buyPrice, cur)}</Sensitive>} />
          <Metric label={position.kind === "fund" ? "Participaciones" : "Cantidad"} value={position.units} />
          <Metric label="Inversión" value={<Sensitive>{formatMoney(invested, cur)}</Sensitive>} />
          <Metric label="Rent. diaria" value={`${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`} tone={isCustom ? undefined : changePct >= 0 ? "up" : "down"} />
          <Metric label="Rent. total" value={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`} tone={pnlPct >= 0 ? "up" : "down"} />
        </div>

        <div className="mt-1 flex gap-2">
          <Button type="button" variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => onEdit(position)}>
            <Pencil className="h-4 w-4" /> Editar
          </Button>
          <Button type="button" variant="destructive" size="sm" className="flex-1 gap-1.5" onClick={() => onDelete(position.id)}>
            <Trash2 className="h-4 w-4" /> Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
