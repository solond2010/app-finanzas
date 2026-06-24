import { AccountCards } from "@/components/dashboard/account-cards"
import { MonthlySummary } from "@/components/dashboard/monthly-summary"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Resumen financiero general</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        <AccountCards />
        <MonthlySummary />
        <TransactionsTable />
        <SinkingFundsGrid />
      </div>
    </div>
  )
}
