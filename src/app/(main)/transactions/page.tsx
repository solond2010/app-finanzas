"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Sparkles, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { Card } from "@/components/ui/card"
import { useFinance } from "@/lib/store"
import { getMonthTotalsByString } from "@/lib/calculations"
import { formatMonth, isInitialBalanceTransaction } from "@/lib/format"
import { AnimatedNumber } from "@/components/shared/animated-number"

export default function TransactionsPage() {
  const { state } = useFinance()
  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0)

  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[32px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Registro financiero completo
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Transacciones</p>
              <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Cada movimiento, al alcance.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Filtra, busca, edita o exporta todos tus ingresos y gastos. Con control total sobre cada registro.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-background/70 px-3 py-2 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
            <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[165px] text-center text-sm font-bold capitalize tracking-tight">{formatMonth(selectedDate)}</span>
            <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {state.accounts.length > 0 && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02]" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Ingresos</span>
                <div className="rounded-2xl bg-background/60 p-2 ring-1 ring-emerald-500/15">
                  <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                </div>
              </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-emerald-500">
                +<AnimatedNumber value={monthTotals.ingresos} />
              </p>
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-red-500/[0.02]" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Gastos</span>
                <div className="rounded-2xl bg-background/60 p-2 ring-1 ring-red-500/15">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                </div>
              </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums text-red-500">
                -<AnimatedNumber value={monthTotals.gastos} />
              </p>
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-500/[0.02]" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Neto del mes</span>
                <div className="rounded-2xl bg-background/60 p-2 ring-1 ring-blue-500/15">
                  <Activity className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <p className={`text-[28px] font-bold leading-none tracking-tight tabular-nums ${monthTotals.neto >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                <AnimatedNumber value={monthTotals.neto} prefix={monthTotals.neto >= 0 ? "+" : ""} />
              </p>
            </div>
          </Card>
        </section>
      )}

      <TransactionsTable selectedMonth={selectedMonth} />
    </div>
  )
}
