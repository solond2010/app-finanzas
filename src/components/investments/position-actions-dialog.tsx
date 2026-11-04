"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { useInvestments, type Position } from "@/lib/investments"
import { useFinance, generateId } from "@/lib/store"
import { computeSale, saleTotalFromPrice, unitPriceFromTotal, type PortfolioRow } from "@/lib/portfolio"
import { convertFromEur } from "@/lib/currency"
import { localDateKey } from "@/lib/date-utils"
import { money } from "@/lib/format"
import { cn } from "@/lib/utils"
import { HandCoins, Pencil, Trash2 } from "@/components/icons"

type Mode = "menu" | "sell" | "delete"

const parseNum = (v: string) => Number(v.replace(/\s/g, "").replace(",", "."))
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${money(Math.abs(n))}`

/** Acciones sobre una posición: editar, vender o eliminar. */
export function PositionActionsDialog({ position, row, onClose, onEdit }: { position: Position | null; row: PortfolioRow | null; onClose: () => void; onEdit: (p: Position) => void }) {
  const open = !!position && !!row
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        {open && <Body key={position.id} position={position} row={row} onClose={onClose} onEdit={onEdit} />}
      </DialogContent>
    </Dialog>
  )
}

function Body({ position, row, onClose, onEdit }: { position: Position; row: PortfolioRow; onClose: () => void; onEdit: (p: Position) => void }) {
  const { state, dispatch } = useFinance()
  const { remove, update } = useInvestments()
  const { toast } = useToast()
  const [mode, setMode] = useState<Mode>("menu")
  // Precio por unidad: el de mercado si lo hay; si no, el de compra. Unidades ×
  // precio = total; si se edita el total, se recalcula el precio (sin bucles:
  // solo se recalcula en el manejador del campo que se ha tocado).
  const fmt = (n: number | null, d = 2) => (n === null ? "" : n.toLocaleString("es-ES", { useGrouping: false, maximumFractionDigits: d }))
  const cur = row.priceCurrency
  const [units, setUnits] = useState(fmt(position.units, 8))
  const [price, setPrice] = useState(fmt(row.price, 4))
  const [amount, setAmount] = useState(fmt(saleTotalFromPrice(position.units, row.price, cur)))
  const [driver, setDriver] = useState<"price" | "total">("price")
  const onUnits = (v: string) => {
    setUnits(v)
    if (driver === "price") setAmount(fmt(saleTotalFromPrice(parseNum(v), parseNum(price), cur)))
    else setPrice(fmt(unitPriceFromTotal(parseNum(amount), parseNum(v), cur), 4))
  }
  const onPrice = (v: string) => { setPrice(v); setDriver("price"); setAmount(fmt(saleTotalFromPrice(parseNum(units), parseNum(v), cur))) }
  const onAmount = (v: string) => { setAmount(v); setDriver("total"); setPrice(fmt(unitPriceFromTotal(parseNum(v), parseNum(units), cur), 4)) }
  const [record, setRecord] = useState(true)
  const account = state.accounts.find((a) => a.id === position.accountId)
  const sale = computeSale(position, parseNum(units), parseNum(amount))

  const confirmSale = () => {
    if (!sale || !account) return
    const ok = sale.full ? remove(position.id) : update({ ...position, units: sale.remainingUnits })
    if (!ok) { toast("No se pudo guardar de forma segura: falta espacio para la cola local", "error"); return }
    if (record && Math.abs(sale.gain) >= 0.01) {
      // Solo la ganancia/pérdida: lo invertido ya estaba en el saldo.
      const monto = Math.round(Math.abs(convertFromEur(sale.gain, account.currency)) * 100) / 100
      dispatch({ type: "ADD_TRANSACTION", payload: { id: generateId(), cuenta_id: account.id, monto, fecha: localDateKey(), tipo: sale.gain > 0 ? "ingreso" : "gasto", categoria: "Inversiones", es_necesidad: false, descripcion: `Venta ${position.name}`, tags: ["inversion"] } })
    }
    toast(sale.full ? "Posición vendida" : "Venta parcial registrada", "success")
    onClose()
  }

  const confirmDelete = () => {
    if (!remove(position.id)) { toast("No se pudo eliminar ahora mismo", "error"); return }
    toast("Posición eliminada", "success")
    onClose()
  }

  if (mode === "menu") return (
    <>
      <DialogHeader>
        <DialogTitle className="line-clamp-2 break-words">{position.name}</DialogTitle>
        <DialogDescription>{account ? account.nombre : "Sin cuenta"} · vale {money(row.value)}{row.hasQuote ? ` · ${signed(row.gain)}` : ""}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => { onClose(); onEdit(position) }}><Pencil className="size-4 text-primary" />Editar</Button>
        <Button variant="outline" className="h-12 justify-start gap-2" disabled={!account} onClick={() => setMode("sell")}><HandCoins className="size-4 text-[var(--accent-green)]" />Vender{!account && <span className="text-xs text-muted-foreground"> (sin cuenta)</span>}</Button>
        <Button variant="outline" className="h-12 justify-start gap-2" onClick={() => setMode("delete")}><Trash2 className="size-4 text-red-500" />Eliminar (fue un error)</Button>
      </div>
    </>
  )

  if (mode === "delete") return (
    <>
      <DialogHeader>
        <DialogTitle>¿Eliminar esta posición?</DialogTitle>
        <DialogDescription>Se borra «{position.name}» como si nunca la hubieras apuntado. No cambia el saldo de la cuenta ni tus movimientos. Si la has vendido, usa «Vender».</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => setMode("menu")}>Volver</Button>
        <Button variant="destructive" onClick={confirmDelete}>Eliminar</Button>
      </DialogFooter>
    </>
  )

  const gainTone = sale && sale.gain > 0 ? "text-[var(--accent-green)]" : sale && sale.gain < 0 ? "text-red-500" : "text-foreground"
  return (
    <>
      <DialogHeader>
        <DialogTitle>Vender {position.name}</DialogTitle>
        <DialogDescription>Tienes {position.units.toLocaleString("es-ES", { maximumFractionDigits: 8 })} unidades.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Unidades vendidas</span>
            <Input inputMode="decimal" value={units} onChange={(e) => onUnits(e.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="text-xs text-muted-foreground">Precio por unidad ({cur === "EUR" ? "€" : cur})</span>
            <Input inputMode="decimal" value={price} onChange={(e) => onPrice(e.target.value)} placeholder="0,00" />
          </label>
        </div>
        <p className="-mt-1 text-[11px] text-muted-foreground">{row.hasQuote ? "Precio de mercado de ahora; cámbialo si vendiste a otro." : "Sin cotización: puesto el precio de compra; pon el de tu venta."}</p>
        <label className="grid gap-1.5 text-sm">
          <span className="text-xs text-muted-foreground">Total recibido (€)</span>
          <Input inputMode="decimal" value={amount} onChange={(e) => onAmount(e.target.value)} placeholder="0,00" />
        </label>
        {sale ? (
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Te costó</span><span className="tabular-nums">{money(sale.costBasis)}</span></div>
            <div className="mt-1 flex justify-between font-semibold"><span>{sale.gain >= 0 ? "Ganancia" : "Pérdida"}</span><span className={cn("tabular-nums", gainTone)}>{signed(sale.gain)}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{sale.full ? "La posición desaparece." : `Te quedan ${sale.remainingUnits.toLocaleString("es-ES", { maximumFractionDigits: 8 })} unidades.`} El dinero sigue en «{account?.nombre}»{record && Math.abs(sale.gain) >= 0.01 ? `; su saldo ${sale.gain > 0 ? "sube" : "baja"} ${money(Math.abs(sale.gain))} con un movimiento «Venta ${position.name}».` : "."}</p>
          </div>
        ) : (
          <p className="text-xs text-red-500" role="alert">Revisa el importe y las unidades (no puedes vender más de las que tienes).</p>
        )}
        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input type="checkbox" className="mt-0.5 accent-[var(--gold)]" checked={record} onChange={(e) => setRecord(e.target.checked)} />
          <span>Apuntar la ganancia o pérdida en Movimientos. Desmárcalo si ya has actualizado el saldo de la cuenta a mano.</span>
        </label>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setMode("menu")}>Volver</Button>
        <Button disabled={!sale} onClick={confirmSale}>Confirmar venta</Button>
      </DialogFooter>
    </>
  )
}
