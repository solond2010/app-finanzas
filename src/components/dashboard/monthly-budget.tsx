"use client"

import { useMemo, useState } from "react"
import { SlidersHorizontal, Plus } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Sensitive } from "@/components/shared/sensitive"
import { formatMoney } from "@/lib/currency"
import { type Budget, type Transaction, type Category } from "@/lib/store"
import { BudgetDialog } from "@/components/dashboard/budget-dialog"

interface MonthlyBudgetProps {
  budgets: Budget[]
  transactions: Transaction[]
  categories: Category[]
  selectedMonth: string
}

const CARD = "rounded-[24px] bg-white p-4 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 sm:p-6"

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
          categoryColor: category?.color ?? "#64748b",
          spent,
          remaining: budget.amount - spent,
          percentage: budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0,
        }
      })
      .sort((a, b) => b.percentage - a.percentage)
  }, [budgets, transactions, categories, selectedMonth])

  return (
    <div className={CARD}>
      <div className="mb-6 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Presupuesto Mensual</p>
        <button
          onClick={() => setOpen(true)}
          aria-label="Gestionar presupuestos"
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Gestionar
        </button>
      </div>

      {budgetProgress.length === 0 ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center gap-2 rounded-[20px] border border-dashed border-slate-200 px-4 py-8 text-center transition-colors hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/50"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Define tu primer presupuesto</span>
          <span className="text-xs text-slate-400">Asigna límites de gasto por categoría este mes</span>
        </button>
      ) : (
        <div className="space-y-4">
          {budgetProgress.map((b) => {
            const over = b.percentage >= 100
            return (
              <div key={b.id} className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-slate-600 dark:text-slate-400">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                    <span className="truncate">{b.categoryName}</span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${over ? "text-red-500" : "text-slate-900 dark:text-white"}`}>
                    <Sensitive>{formatMoney(b.spent, "EUR")}</Sensitive> / <Sensitive>{formatMoney(b.amount, "EUR")}</Sensitive>
                  </span>
                </div>
                <Progress value={b.percentage} className={`[&_[data-slot=progress-track]]:h-2 ${over ? "[&_[data-slot=progress-indicator]]:bg-red-500" : "[&_[data-slot=progress-indicator]]:bg-foreground"}`} />
              </div>
            )
          })}
        </div>
      )}

      <BudgetDialog open={open} onOpenChange={setOpen} selectedMonth={selectedMonth} />
    </div>
  )
}
