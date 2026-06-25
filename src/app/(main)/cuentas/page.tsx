"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFinance, type Account } from "@/lib/store"
import { getNetWorth } from "@/lib/calculations"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAnimatedNumber } from "@/lib/hooks/use-animated-number"
import { Landmark, ShieldCheck, TrendingUp, Wallet as WalletIcon, CreditCard, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { formatMoney, currencySymbol } from "@/lib/currency"

const typeLabels: Record<string, string> = {
  emergencia: "Emergencia",
  ahorro: "Ahorro",
  inversion: "Inversión",
  efectivo: "Efectivo",
  gastos: "Gastos",
}

const typeConfig: Record<Account["tipo"], { label: string; icon: React.ElementType; color: string; tint: string }> = {
  emergencia: { label: "Emergencia", icon: ShieldCheck, color: "#10b981", tint: "from-emerald-500/16 to-emerald-500/[0.02]" },
  ahorro: { label: "Ahorro", icon: WalletIcon, color: "#3b82f6", tint: "from-blue-500/16 to-blue-500/[0.02]" },
  inversion: { label: "Inversión", icon: TrendingUp, color: "#8b5cf6", tint: "from-violet-500/16 to-violet-500/[0.02]" },
  efectivo: { label: "Efectivo", icon: Landmark, color: "#f59e0b", tint: "from-amber-500/16 to-amber-500/[0.02]" },
  gastos: { label: "Gastos", icon: CreditCard, color: "#ef4444", tint: "from-red-500/16 to-red-500/[0.02]" },
}

function AnimatedMoney({ value }: { value: number }) {
  const animated = useAnimatedNumber(Math.round(value))
  return <>{animated.toLocaleString("es-ES")}€</>
}

export default function CuentasPage() {
  const { state } = useFinance()
  const router = useRouter()
  const netWorth = getNetWorth(state.accounts)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const totalBalance = state.accounts.reduce((s, a) => s + a.saldo, 0)

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[32px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_85%_0%,rgba(16,185,129,0.14),transparent_30%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Tus cuentas
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Patrimonio</p>
              <h1 className="max-w-3xl text-[34px] font-bold leading-[0.95] tracking-tight sm:text-[44px] lg:text-[52px]">Todo tu dinero, centralizado.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Saldos, bancos y progreso de objetivos financieros en un solo vistazo.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[22px] bg-background/60 px-6 py-4 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Patrimonio neto total</p>
            <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-[38px]">
              {mounted ? <AnimatedMoney value={netWorth} /> : `${netWorth.toLocaleString("es-ES")}€`}
            </p>
          </div>
        </div>
      </section>

      {state.accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-24 text-center">
          <div className="rounded-full bg-muted/50 p-6 ring-1 ring-border/30">
            <WalletIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Sin cuentas aún</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Añade tu primera cuenta bancaria para empezar a gestionar tus finanzas.</p>
          </div>
          <p className="text-sm text-muted-foreground">Usa el botón <strong>+</strong> en la barra lateral para añadir tu primera cuenta.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.accounts.map((account, index) => {
              const cfg = typeConfig[account.tipo]
              const Icon = cfg.icon
              return (
                <button
                  key={account.id}
                  onClick={() => router.push(`/cuentas/${account.id}`)}
                  className="stagger-fade group relative overflow-hidden rounded-[22px] bg-card/70 p-6 text-left shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${cfg.tint} opacity-60`} />
                  <div className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-2xl bg-background/60 p-2.5 ring-1 ring-border/15`}>
                          <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                        </div>
                        <div>
                          <h3 className="font-semibold text-base">{account.nombre}</h3>
                          <p className="text-xs text-muted-foreground">{account.banco || "Sin banco"}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-background/60 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground ring-1 ring-border/15">
                        {cfg.label}
                      </span>
                    </div>

                    <div>
                      <p className="text-3xl font-bold tabular-nums tracking-tight">
                        {formatMoney(account.saldo, account.currency)}
                      </p>
                    </div>

                    {account.objetivo && account.objetivo > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Objetivo: {account.objetivo.toLocaleString("es-ES")} {currencySymbol(account.currency)}</span>
                          <span>{Math.round((account.saldo / account.objetivo) * 100)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.min((account.saldo / account.objetivo) * 100, 100)}%`,
                              backgroundColor: cfg.color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <WalletIcon className="h-4 w-4 text-muted-foreground" />
                Resumen de cuentas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Banco</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="text-right">Objetivo</TableHead>
                    <TableHead className="text-right w-24">Progreso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.accounts.map((a) => {
                    const progress = a.objetivo && a.objetivo > 0 ? Math.min(Math.round((a.saldo / a.objetivo) * 100), 100) : null
                    return (
                      <TableRow key={a.id} className="cursor-pointer group" onClick={() => router.push(`/cuentas/${a.id}`)}>
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{typeLabels[a.tipo]}</TableCell>
                        <TableCell className="text-muted-foreground">{a.banco || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          {formatMoney(a.saldo, a.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {a.objetivo ? `${a.objetivo.toLocaleString("es-ES")} ${currencySymbol(a.currency)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {progress !== null ? (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${progress >= 80 ? "bg-emerald-500/10 text-emerald-500" : progress >= 40 ? "bg-amber-500/10 text-amber-500" : "bg-muted/60 text-muted-foreground"}`}>
                              {progress}%
                            </span>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right tabular-nums font-bold text-lg">
                      {totalBalance.toLocaleString("es-ES")}€
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
