"use client"

import { useState, useMemo } from "react"
import { AccountCards } from "@/components/dashboard/account-cards"
import { MonthlySummary } from "@/components/dashboard/monthly-summary"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { useFinance } from "@/lib/store"
import { ChevronLeft, ChevronRight } from "lucide-react"

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className ?? ""}`} />
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 18) return "Buenas tardes"
  return "Buenas noches"
}

export default function DashboardPage() {
  const { state, loading } = useFinance()
  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0)

  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`

  const showSelector = state.transactions.length > 0

  const totalIngresos = useMemo(
    () => state.transactions.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + t.monto, 0),
    [state.transactions]
  )
  const totalGastos = useMemo(
    () => state.transactions.filter((t) => t.tipo === "gasto").reduce((s, t) => s + t.monto, 0),
    [state.transactions]
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 rounded-[28px] bg-card/60 backdrop-blur-xl p-7 shadow-sm ring-1 ring-border/30 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">Dashboard</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight sm:text-[32px]">{getGreeting()}</h1>
          <p className="text-sm text-muted-foreground">
            {formatMonth(selectedDate)}
            {state.accounts.length > 0 && (
              <> · {state.accounts.length} cuentas</>
            )}
            {state.transactions.length > 0 && (
              <> · {(totalGastos + totalIngresos).toLocaleString("es-ES")}€ en movimientos</>
            )}
          </p>
        </div>
        {showSelector && (
          <div className="flex items-center gap-2 rounded-2xl bg-muted/60 backdrop-blur-sm px-3 py-2 ring-1 ring-border/20">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[150px] text-center text-sm font-semibold capitalize tracking-tight">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-all active:scale-90">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <div className="col-span-full"><Skeleton className="h-64" /></div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <AccountCards selectedMonth={selectedMonth} />
          <MonthlySummary selectedMonth={selectedMonth} />
          <TransactionsTable selectedMonth={selectedMonth} />
          <SinkingFundsGrid />
        </div>
      )}
    </div>
  )
}
