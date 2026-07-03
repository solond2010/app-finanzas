"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useFinance, type Account } from "@/lib/store"
import { usePortfolioValue, accountDisplayValue } from "@/lib/investments"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Wallet as WalletIcon, Plus } from "lucide-react"
import { formatMoney, currencySymbol } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { typeConfig, typeLabels } from "@/lib/account-types"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { useMemo, useState } from "react"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { useToast } from "@/components/ui/toast"
import { TickerTile } from "@/components/shared/ticker-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"

export default function CuentasPage() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const { valueByAccount, investedByAccount } = usePortfolioValue()
  const [showNewAccount, setShowNewAccount] = useState(false)

  // Para cuentas de inversión, el saldo bruto no baja al comprar una posición
  // (no genera un gasto): se sustituye solo la parte ya invertida por su valor
  // de mercado, dejando intacto el efectivo restante aún sin invertir.
  const accountValue = (a: Account) => accountDisplayValue(a, valueByAccount, investedByAccount)
  const netWorth = state.accounts.reduce((s, a) => s + accountValue(a), 0)

  // Cuenta con mayor saldo y cuenta más cerca de completar su objetivo, para
  // el ticker superior (solo cuando hay cuentas registradas).
  const topAccount = useMemo(() => (state.accounts.length === 0 ? null : state.accounts.slice().sort((a, b) => accountValue(b) - accountValue(a))[0]), [state.accounts, valueByAccount, investedByAccount]) // eslint-disable-line react-hooks/exhaustive-deps
  const nearestGoal = useMemo(() => {
    return state.accounts
      .filter((a) => a.objetivo && a.objetivo > 0)
      .map((a) => ({ account: a, pct: Math.min((accountValue(a) / (a.objetivo as number)) * 100, 100) }))
      .sort((a, b) => b.pct - a.pct)[0] ?? null
  }, [state.accounts, valueByAccount, investedByAccount]) // eslint-disable-line react-hooks/exhaustive-deps
  const liquidNetWorth = state.accounts.filter((a) => a.tipo !== "inversion").reduce((s, a) => s + accountValue(a), 0)
  const liquidPct = netWorth > 0 ? Math.round((liquidNetWorth / netWorth) * 100) : 0

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-section-label">Patrimonio</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saldos, bancos y progreso de objetivos en un vistazo.</p>
        </div>
        <div className="flex flex-col gap-1 rounded-[16px] hero-panel px-5 py-3.5 sm:items-end">
          <p className="page-section-label">Patrimonio neto total</p>
          <p className="hero-figure text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-[30px]">
            <Sensitive as="span"><AnimatedNumber value={netWorth} /></Sensitive>
          </p>
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" />
          </div>
        </div>
      ) : state.accounts.length === 0 ? (
        <EmptyState
          className="py-24"
          icon={WalletIcon}
          title="Sin cuentas aún"
          description="Añade tu primera cuenta bancaria para empezar a gestionar tus finanzas."
          action={{ label: "Crear primera cuenta", icon: Plus, onClick: () => setShowNewAccount(true) }}
        />
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <TickerTile label="Cuentas" value={String(state.accounts.length)} valueColor="var(--primary)" />
            <TickerTile label="Cuenta líder" value={topAccount ? formatMoney(accountValue(topAccount), topAccount.currency) : "—"} detail={topAccount?.nombre} valueColor="var(--gold)" />
            <TickerTile label="Objetivo más cerca" value={nearestGoal ? `${Math.round(nearestGoal.pct)}%` : "—"} detail={nearestGoal?.account.nombre} valueColor="var(--accent-green)" />
            <TickerTile label="Liquidez" value={`${liquidPct}%`} valueColor="var(--accent-blue)" />
          </section>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {state.accounts.map((account, index) => {
              const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
              return (
                <button
                  key={account.id}
                  onClick={() => router.push(`/cuentas/${account.id}`)}
                  className="stagger-fade group rounded-[16px] border border-border bg-card p-6 text-left glass-card-hover"
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <AccountLogo account={account} className="h-11 w-11" />
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
              className="stagger-fade flex flex-col items-center justify-center gap-3 rounded-[16px] border border-dashed border-muted-foreground/25 p-6 text-muted-foreground transition-colors hover:border-muted-foreground/50 hover:text-foreground"
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
