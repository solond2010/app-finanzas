"use client"

import { useEffect, useMemo, useState } from "react"
import { useFinance, USER_ID } from "@/lib/store"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { formatMonth } from "@/lib/format"

interface BudgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedMonth: string
}

export function BudgetDialog({ open, onOpenChange, selectedMonth }: BudgetDialogProps) {
  const { state, dispatch } = useFinance()
  const { toast } = useToast()
  const [amounts, setAmounts] = useState<Record<string, string>>({})

  const monthLabel = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number)
    return formatMonth(new Date(y, (m ?? 1) - 1, 1))
  }, [selectedMonth])

  // Precarga los importes existentes del mes al abrir el diálogo.
  useEffect(() => {
    if (!open) return
    queueMicrotask(() => {
      const next: Record<string, string> = {}
      for (const b of state.budgets) {
        if (b.month === selectedMonth) next[b.category_id] = String(b.amount)
      }
      setAmounts(next)
    })
  }, [open, selectedMonth, state.budgets])

  // Solo categorías donde puede haber gasto: un "límite mensual" sobre una
  // categoría de ingreso (Dividendos, Bonus…) no vigila nada — el widget de
  // presupuesto solo computa transacciones de tipo gasto — y llenaba la
  // lista de filas inútiles.
  const sortedCategories = useMemo(
    () => state.categories
      .filter((c) => !c.kind || c.kind === "gasto" || c.kind === "both")
      .sort((a, b) => a.name.localeCompare(b.name, "es")),
    [state.categories]
  )

  const handleSave = () => {
    for (const cat of state.categories) {
      const existing = state.budgets.find((b) => b.category_id === cat.id && b.month === selectedMonth)
      const raw = (amounts[cat.id] ?? "").trim()
      const value = raw === "" ? 0 : Number(raw)

      if (!Number.isFinite(value) || value <= 0) {
        if (existing) dispatch({ type: "DELETE_BUDGET", payload: existing.id })
        continue
      }
      if (existing) {
        if (existing.amount !== value) dispatch({ type: "UPDATE_BUDGET", payload: { ...existing, amount: value } })
      } else {
        dispatch({ type: "ADD_BUDGET", payload: { category_id: cat.id, amount: value, month: selectedMonth, user_id: USER_ID } })
      }
    }
    toast("Presupuestos actualizados", "success")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Presupuestos de {monthLabel}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">Asigna un límite mensual por categoría. Déjalo vacío o en 0 para quitarlo.</p>

        <div className="-mx-1 max-h-[55vh] space-y-2 overflow-y-auto px-1 py-1">
          {sortedCategories.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No hay categorías. Crea alguna en Configuración.</p>
          ) : (
            sortedCategories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-3 rounded-2xl bg-muted/40 px-3 py-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{cat.name}</span>
                <div className="relative w-28 shrink-0">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">€</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1"
                    value={amounts[cat.id] ?? ""}
                    onChange={(e) => setAmounts((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                    placeholder="0"
                    className="pl-7 text-right tabular-nums"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" size="sm" onClick={handleSave}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
