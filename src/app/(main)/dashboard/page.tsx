"use client"

import { useState } from "react"
import { AccountCards } from "@/components/dashboard/account-cards"
import { MonthlySummary } from "@/components/dashboard/monthly-summary"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { useFinance } from "@/lib/store"
import { ChevronLeft, ChevronRight } from "lucide-react"

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

export default function DashboardPage() {
  const { state, loading } = useFinance()
  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0)

  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const showSelector = state.transactions.length > 0

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/30 p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Resumen financiero general y evolución reciente.</p>
        </div>
        {showSelector && (
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-background/80 px-3 py-2 shadow-sm backdrop-blur-sm">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[160px] text-center text-sm font-medium capitalize">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-full grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="col-span-full"><Skeleton className="h-64" /></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <AccountCards />
          <MonthlySummary selectedMonth={monthOffset > 0 ? selectedMonth : undefined} />
          <TransactionsTable />
          <SinkingFundsGrid />
        </div>
      )}
    </div>
  )
}
