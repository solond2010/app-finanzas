"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFinance } from "@/lib/store"
import { getNetWorth } from "@/lib/calculations"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Wallet } from "lucide-react"

const typeLabels: Record<string, string> = {
  emergencia: "Emergencia",
  ahorro: "Ahorro",
  inversion: "Inversión",
  efectivo: "Efectivo",
}

export default function CuentasPage() {
  const { state } = useFinance()
  const netWorth = getNetWorth(state.accounts)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cuentas</h1>
        <p className="text-muted-foreground">Todas tus cuentas bancarias y su saldo</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {state.accounts.map((account) => (
          <div
            key={account.id}
            className="rounded-xl border bg-card p-6 space-y-4 transition-all hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full p-2.5" style={{ backgroundColor: `${account.color}20` }}>
                  <Wallet className="h-5 w-5" style={{ color: account.color }} />
                </div>
                <div>
                  <h3 className="font-semibold">{account.nombre}</h3>
                  <p className="text-xs text-muted-foreground">{account.banco || "Sin banco"}</p>
                </div>
              </div>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                {typeLabels[account.tipo]}
              </span>
            </div>

            <div>
              <p className="text-3xl font-bold tabular-nums">
                {account.saldo.toLocaleString("es-ES")}€
              </p>
            </div>

            {account.objetivo && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Objetivo: {account.objetivo.toLocaleString("es-ES")}€</span>
                  <span>{Math.round((account.saldo / account.objetivo) * 100)}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min((account.saldo / account.objetivo) * 100, 100)}%`,
                      backgroundColor: account.color,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Resumen de Patrimonio</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuenta</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Banco</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{typeLabels[a.tipo]}</TableCell>
                  <TableCell className="text-muted-foreground">{a.banco || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {a.saldo.toLocaleString("es-ES")}€
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">Patrimonio Neto</TableCell>
                <TableCell className="text-right tabular-nums font-bold text-lg">
                  {netWorth.toLocaleString("es-ES")}€
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
