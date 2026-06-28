import React, { useMemo } from "react"
import { Progress } from "@/components/ui/progress"
import { Sensitive } from "@/components/shared/sensitive"
import { formatMoney } from "@/lib/currency"
import { type Budget, type Transaction, type Category } from "@/lib/store"

interface MonthlyBudgetProps {
  budgets: Budget[]
  transactions: Transaction[]
  categories: Category[]
  selectedMonth: string
}

export function MonthlyBudget({ budgets, transactions, categories, selectedMonth }: MonthlyBudgetProps) {
  const budgetProgress = useMemo(() => {
    return budgets
      .filter(b => b.month === selectedMonth)
      .map(budget => {
        const category = categories.find(c => c.id === budget.category_id)
        const spent = transactions
          .filter(t => t.categoria === category?.name && t.fecha.startsWith(selectedMonth) && t.tipo === "gasto")
          .reduce((sum, t) => sum + t.monto, 0)
        
        return {
          ...budget,
          categoryName: category?.name || "Desconocida",
          categoryColor: category?.color || "#64748b",
          spent,
          remaining: budget.amount - spent,
          percentage: Math.min((spent / budget.amount) * 100, 100)
        }
      })
  }, [budgets, transactions, categories, selectedMonth])

  if (budgetProgress.length === 0) return null

  return (
    <div className="rounded-[24px] bg-white p-6 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <p className="text-sm font-semibold text-slate-900 dark:text-white mb-6">Presupuesto Mensual</p>
      <div className="space-y-4">
        {budgetProgress.map(b => (
          <div key={b.id} className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-600 dark:text-slate-400">{b.categoryName}</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                <Sensitive>{formatMoney(b.spent, "EUR")}</Sensitive> / <Sensitive>{formatMoney(b.amount, "EUR")}</Sensitive>
              </span>
            </div>
            <Progress value={b.percentage} className={`h-2 ${b.percentage >= 90 ? "bg-red-500" : "bg-blue-600"}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
