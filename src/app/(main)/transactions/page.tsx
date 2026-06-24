import { TransactionsTable } from "@/components/dashboard/transactions-table"

export default function TransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transacciones</h1>
        <p className="text-muted-foreground">Historial completo de ingresos y gastos</p>
      </div>
      <TransactionsTable />
    </div>
  )
}
