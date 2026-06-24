"use client"

import { useState, useMemo } from "react"
import { AccountCards } from "@/components/dashboard/account-cards"
import { MonthlySummary } from "@/components/dashboard/monthly-summary"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { useFinance } from "@/lib/store"
import { ChevronLeft, ChevronRight } from "lucide-react"

function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

export default function DashboardPage() {
  const { state } = useFinance()
  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0)

  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const showSelector = state.transactions.length > 0

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen financiero general</p>
        </div>
        {showSelector && (
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="p-0.5 hover:text-foreground text-muted-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium min-w-[140px] text-center capitalize">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="p-0.5 hover:text-foreground text-muted-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <AccountCards />
        <MonthlySummary selectedMonth={monthOffset > 0 ? selectedMonth : undefined} />
        <TransactionsTable />
        <SinkingFundsGrid />
      </div>
    </div>
  )
}
