"use client"

import { useMemo, useState } from "react"
import { SlidersHorizontal, Plus, AlertTriangle } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Sensitive } from "@/components/shared/sensitive"
import { formatMoney } from "@/lib/currency"
import { type Budget, type Transaction, type Category } from "@/lib/store"
import { BudgetDialog } from "@/components/dashboard/budget-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { cn } from "@/lib/utils"

// A partir de este % de un presupuesto se avisa (ámbar); a partir de 100% ya
// está superado (rojo).
const WARNING_THRESHOLD = 80

interface MonthlyBudgetProps {
  budgets: Budget[]
  transactions: Transaction[]
  categories: Category[]
  selectedMonth: string
}

const CARD = "rounded-[16px] border border-border bg-card p-4 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.04),0_14px_34px_-24px_rgba(0,0,0,0.30)] sm:p-6"

export function MonthlyBudget({ budgets, transactions, categories, selectedMonth }: MonthlyBudgetProps) {
  const [open, setOpen] = useState(false)

  const budgetProgress = useMemo(() => {
    return budgets
      .filter((b) => b.month === selectedMonth)
      .map((budget) => {
        const category = categories.find((c) => c.id === budget.category_id)
        const spent = transactions
          .filter((t) => t.categoria === category?.name && t.fecha.startsWith(selectedMonth) && t.tipo === "gasto")
          .reduce((sum, t) => sum + t.monto, 0)

        return {
          ...budget,
          categoryName: category?.name ?? "Sin categoría",
          categoryColor: category?.color ?? "var(--muted-foreground)",
          spent,
          remaining: budget.amount - spent,
          percentage: budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)
  }, [budgets, transactions, categories, selectedMonth])

  const overCount = budgetProgress.filter((b) => b.percentage >= 100).length
  const warningCount = budgetProgress.filter((b) => b.percentage >= WARNING_THRESHOLD && b.percentage < 100).length

  return (
    <div className={CARD}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">Presupuesto Mensual</p>
          {(overCount > 0 || warningCount > 0) && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              overCount > 0 ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"
            )}>
              <AlertTriangle className="h-3 w-3" />
              {overCount > 0
                ? `${overCount} superado${overCount > 1 ? "s" : ""}`
                : `${warningCount} cerca del límite`}
            </span>
          )}
        </div>
        <button
          onClick={() => setOpen(true)}
          aria-label="Gestionar presupuestos"
          className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground active:scale-95"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Gestionar
        </button>
      </div>

      {budgetProgress.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={SlidersHorizontal}
          title="Define tu primer presupuesto"
          description="Asigna límites de gasto por categoría este mes."
          action={{ label: "Definir presupuesto", icon: Plus, onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="space-y-4">
          {budgetProgress.map((b) => {
            const over = b.percentage >= 100
            const warning = !over && b.percentage >= WARNING_THRESHOLD
            return (
              <div key={b.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-muted-foreground">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                    <span className="truncate">{b.categoryName}</span>
                    {(over || warning) && <AlertTriangle className={cn("h-3 w-3 shrink-0", over ? "text-red-500" : "text-amber-500")} />}
                  </span>
                  <span className={cn(
                    "shrink-0 font-semibold tabular-nums",
                    over ? "text-red-500" : warning ? "text-amber-500" : "text-foreground"
                  )}>
                    <Sensitive>{formatMoney(b.spent, "EUR")}</Sensitive> / <Sensitive>{formatMoney(b.amount, "EUR")}</Sensitive>
                  </span>
                </div>
                <Progress value={b.percentage} className={cn(
                  "[&_[data-slot=progress-track]]:h-2",
                  over ? "[&_[data-slot=progress-indicator]]:bg-red-500" : warning ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-foreground"
                )} />
              </div>
            )
          })}
        </div>
      )}

      <BudgetDialog open={open} onOpenChange={setOpen} selectedMonth={selectedMonth} />
    </div>
  )
}
