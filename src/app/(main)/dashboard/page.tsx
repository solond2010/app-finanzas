"use client"

import { useState, useMemo } from "react"
import { AccountCards } from "@/components/dashboard/account-cards"
import { MonthlySummary } from "@/components/dashboard/monthly-summary"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { useFinance } from "@/lib/store"
import { ChevronLeft, ChevronRight, Wallet, Plus } from "lucide-react"
import Link from "next/link"

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className ?? ""}`} />
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="col-span-full flex items-center gap-3">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">{label}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  )
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
      ) : state.accounts.length === 0 && state.transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div className="rounded-full bg-muted/50 p-6 ring-1 ring-border/30">
            <Wallet className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Bienvenido a App Finanzas</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Crea tu primera cuenta para empezar a gestionar tus finanzas.</p>
          </div>
          <Link
            href="/cuentas"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Crear cuenta
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          <AccountCards selectedMonth={selectedMonth} />
          <SectionLabel label="Estadísticas" />
          <MonthlySummary selectedMonth={selectedMonth} />
          <SectionLabel label="Movimientos" />
          <TransactionsTable selectedMonth={selectedMonth} />
          <SectionLabel label="Metas" />
          <SinkingFundsGrid />
        </div>
      )}
    </div>
  )
}
