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
import { formatMoney, currencySymbol } from "@/lib/currency"

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
      <div className="flex flex-col gap-4 rounded-[28px] bg-card/60 backdrop-blur-xl p-7 shadow-sm ring-1 ring-border/30 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-[0.08em]">Cuentas</p>
          <h1 className="text-[28px] font-bold tracking-tight leading-tight sm:text-[32px]">Tus Cuentas</h1>
          <p className="text-sm text-muted-foreground">Saldos, bancos y progreso de objetivos financieros.</p>
        </div>
        <div className="rounded-2xl bg-muted/60 backdrop-blur-sm px-5 py-3 ring-1 ring-border/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Patrimonio neto</p>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{netWorth.toLocaleString("es-ES")}€</p>
        </div>
      </div>

      {state.accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div className="rounded-full bg-muted/50 p-6 ring-1 ring-border/30">
            <Wallet className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Sin cuentas aún</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Añade tu primera cuenta bancaria para empezar a gestionar tus finanzas.</p>
          </div>
          <p className="text-sm text-muted-foreground">Usa el botón <strong>+</strong> en la barra lateral para añadir tu primera cuenta.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {state.accounts.map((account) => (
          <div
            key={account.id}
            className="overflow-hidden rounded-[20px] bg-card/70 backdrop-blur-xl p-6 shadow-sm ring-1 ring-border/20 transition-all duration-300 ease-in-out hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl p-2.5" style={{ backgroundColor: `${account.color}20` }}>
                  <Wallet className="h-5 w-5" style={{ color: account.color }} />
                </div>
                <div>
                  <h3 className="font-semibold text-base">{account.nombre}</h3>
                  <p className="text-xs text-muted-foreground">{account.banco || "Sin banco"}</p>
                </div>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {typeLabels[account.tipo]}
              </span>
            </div>

            <div>
              <p className="text-3xl font-bold tabular-nums tracking-tight">
                {formatMoney(account.saldo, account.currency)}
              </p>
            </div>

            {account.objetivo && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Objetivo: {account.objetivo.toLocaleString("es-ES")} {currencySymbol(account.currency)}</span>
                  <span>{Math.round((account.saldo / account.objetivo) * 100)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
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
      )}

      {state.accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Resumen de Patrimonio</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
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
                      {formatMoney(a.saldo, a.currency)}
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
      )}
    </div>
  )
}
