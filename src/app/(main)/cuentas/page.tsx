"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFinance, type Account } from "@/lib/store"
import { usePortfolioValue } from "@/lib/investments"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Wallet as WalletIcon, Sparkles, Plus } from "lucide-react"
import { formatMoney, currencySymbol } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { typeConfig, typeLabels } from "@/lib/account-types"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { useToast } from "@/components/ui/toast"

export default function CuentasPage() {
  const { state, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const { valueByAccount } = usePortfolioValue()
  const [showNewAccount, setShowNewAccount] = useState(false)

  // Para cuentas de inversión, el "saldo" real es el valor de mercado de sus
  // posiciones (no el saldo manual, que queda obsoleto al registrar inversiones).
  const accountValue = (a: Account) => (a.tipo === "inversion" && valueByAccount[a.id] != null ? valueByAccount[a.id] : a.saldo)
  const netWorth = state.accounts.reduce((s, a) => s + accountValue(a), 0)

  return (
    <div className="space-y-7">
      <section className="hero-gradient rounded-[24px] bg-card/70 p-6 sm:p-8 card-glow">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Tus cuentas
            </div>
            <div className="space-y-2">
              <p className="page-section-label">Patrimonio</p>
              <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Todo tu dinero, centralizado.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Saldos, bancos y progreso de objetivos financieros en un solo vistazo.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[22px] bg-background/60 px-6 py-4 card-glow">
            <p className="page-section-label">Patrimonio neto total</p>
            <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-[38px]">
              <Sensitive as="span"><AnimatedNumber value={netWorth} /></Sensitive>
            </p>
          </div>
        </div>
      </section>

      {state.accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 py-24 text-center">
          <div className="rounded-full bg-muted/50 p-6 ring-1 ring-border/30">
            <WalletIcon className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight">Sin cuentas aún</h2>
            <p className="text-sm text-muted-foreground max-w-sm">Añade tu primera cuenta bancaria para empezar a gestionar tus finanzas.</p>
          </div>
          <Button className="gap-2 rounded-full" onClick={() => setShowNewAccount(true)}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.accounts.map((account, index) => {
              const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
              const Icon = cfg.icon
              return (
                <button
                  key={account.id}
                  onClick={() => router.push(`/cuentas/${account.id}`)}
                  className="stagger-fade group relative overflow-hidden rounded-[22px] bg-card/70 p-6 text-left ring-1 ring-border/25 backdrop-blur-xl card-glow glass-card-hover"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${cfg.tint} opacity-60 rounded-[22px]`} />
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
                        <Sensitive>{formatMoney(accountValue(account), account.currency)}</Sensitive>
                      </p>
                    </div>

                    {account.objetivo && account.objetivo > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Objetivo: <Sensitive>{account.objetivo.toLocaleString("es-ES")} {currencySymbol(account.currency)}</Sensitive></span>
                          <span>{Math.round((accountValue(account) / account.objetivo) * 100)}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.min((accountValue(account) / account.objetivo) * 100, 100)}%`,
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
            <button
              onClick={() => setShowNewAccount(true)}
              className="stagger-fade flex flex-col items-center justify-center gap-3 rounded-[22px] border-2 border-dashed border-muted-foreground/25 p-6 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground transition-all duration-300 hover:-translate-y-1 hover:shadow-md bg-card/50 backdrop-blur-sm ring-1 ring-border/10"
              style={{ animationDelay: `${state.accounts.length * 60}ms` }}
            >
              <Plus className="h-8 w-8" />
              <span className="text-sm font-medium">Nueva Cuenta</span>
            </button>
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
                    const progress = a.objetivo && a.objetivo > 0 ? Math.min(Math.round((accountValue(a) / a.objetivo) * 100), 100) : null
                    return (
                      <TableRow key={a.id} className="cursor-pointer group transition-colors hover:bg-muted/20" onClick={() => router.push(`/cuentas/${a.id}`)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && router.push(`/cuentas/${a.id}`)} role="button">
                        <TableCell className="font-medium">{a.nombre}</TableCell>
                        <TableCell className="text-muted-foreground">{typeLabels[a.tipo]}</TableCell>
                        <TableCell className="text-muted-foreground">{a.banco || "—"}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">
                          <Sensitive>{formatMoney(accountValue(a), a.currency)}</Sensitive>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {a.objetivo ? <Sensitive>{a.objetivo.toLocaleString("es-ES")} {currencySymbol(a.currency)}</Sensitive> : "—"}
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
                      <Sensitive>{Math.round(netWorth).toLocaleString("es-ES")}€</Sensitive>
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={(a) => { dispatch({ type: "ADD_ACCOUNT", payload: a }); setShowNewAccount(false); toast("Cuenta creada", "success") }} />
    </div>
  )
}
