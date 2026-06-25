"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BarChart, LineChart } from "@tremor/react"
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, CircleDollarSign, CreditCard, Flame, Landmark, Plus, ShieldCheck, Sparkles, Target, TrendingUp, Wallet } from "lucide-react"

import { AccountDialog } from "@/components/dashboard/account-dialog"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TransactionsTable } from "@/components/dashboard/transactions-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/components/ui/toast"
import { buildMonthlySummariesUpTo, getAccountsAtMonth, getGastosBudgetProgress, getMonthTotalsByString, getNetWorthAtMonth } from "@/lib/calculations"
import { currencySymbol, formatMoney } from "@/lib/currency"
import { generateId, type Account, useFinance } from "@/lib/store"
import { useAnimatedNumber } from "@/lib/hooks/use-animated-number"

const chartFormatter = (value: number) => `${value.toLocaleString("es-ES")}€`

const typeConfig: Record<Account["tipo"], { label: string; icon: React.ElementType; color: string; tint: string }> = {
  emergencia: { label: "Emergencia", icon: ShieldCheck, color: "#10b981", tint: "from-emerald-500/16 to-emerald-500/[0.02]" },
  ahorro: { label: "Ahorro", icon: Wallet, color: "#3b82f6", tint: "from-blue-500/16 to-blue-500/[0.02]" },
  inversion: { label: "Inversión", icon: TrendingUp, color: "#8b5cf6", tint: "from-violet-500/16 to-violet-500/[0.02]" },
  efectivo: { label: "Efectivo", icon: Landmark, color: "#f59e0b", tint: "from-amber-500/16 to-amber-500/[0.02]" },
  gastos: { label: "Gastos", icon: CreditCard, color: "#ef4444", tint: "from-red-500/16 to-red-500/[0.02]" },
}

function money(value: number) {
  return `${value.toLocaleString("es-ES")}€`
}

function signedMoney(value: number) {
  return `${value >= 0 ? "+" : ""}${money(value)}`
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("es-ES", { month: "long", year: "numeric" })
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return "Buenos días"
  if (h < 18) return "Buenas tardes"
  return "Buenas noches"
}

function isInitialBalanceTransaction(id: string) {
  return id.startsWith("init_")
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-[24px] ${className ?? ""}`} />
}

function AnimatedMoney({ value, prefix = "" }: { value: number; prefix?: string }) {
  const animated = useAnimatedNumber(Math.round(value))
  return <>{prefix}{animated.toLocaleString("es-ES")}€</>
}

function SectionTitle({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="col-span-full flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{eyebrow}</p>
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        {text && <p className="max-w-2xl text-sm text-muted-foreground">{text}</p>}
      </div>
      {action}
    </div>
  )
}

function SnapshotCard({ label, value, subtitle, icon: Icon, color, delay }: { label: string; value: React.ReactNode; subtitle: string; icon: React.ElementType; color: string; delay: number }) {
  return (
    <div className="stagger-fade rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
        <span className="rounded-2xl bg-background/60 p-2 ring-1 ring-border/20">
          <Icon className="h-4 w-4" style={{ color }} />
        </span>
      </div>
      <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums" style={{ color }}>{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function EmptyWelcome({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-[34px] bg-card/70 p-8 text-center shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.16),transparent_35%),radial-gradient(circle_at_10%_100%,rgba(16,185,129,0.14),transparent_35%)]" />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center gap-5">
        <div className="rounded-[28px] bg-background/70 p-5 shadow-sm ring-1 ring-border/25">
          <Wallet className="h-10 w-10 text-muted-foreground/55" />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Primer paso</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Construye tu centro financiero.</h2>
          <p className="text-sm leading-6 text-muted-foreground">Crea tu primera cuenta y empieza a registrar movimientos. El dashboard se convertirá en tu resumen diario de patrimonio, gastos y metas.</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button className="gap-2 rounded-full px-5" onClick={onCreateAccount}><Plus className="h-4 w-4" />Crear primera cuenta</Button>
          <Link href="/analytics" className="inline-flex h-9 items-center justify-center rounded-full border border-input bg-background px-5 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.97]">Ver analíticas</Link>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const today = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [showNewAccount, setShowNewAccount] = useState(false)

  const selectedDate = new Date(today.getFullYear(), today.getMonth() - monthOffset, 1)
  const previousDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
  const selectedMonth = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
  const previousMonth = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`
  const analysisTransactions = useMemo(() => state.transactions.filter((t) => !isInitialBalanceTransaction(t.id)), [state.transactions])
  const hasAnyData = state.accounts.length > 0 || analysisTransactions.length > 0 || state.sinkingFunds.length > 0

  const monthTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const previousTotals = useMemo(() => getMonthTotalsByString(analysisTransactions, previousMonth), [analysisTransactions, previousMonth])
  const displayAccounts = useMemo(() => getAccountsAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const netWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, selectedMonth), [state.accounts, state.transactions, selectedMonth])
  const previousNetWorth = useMemo(() => getNetWorthAtMonth(state.accounts, state.transactions, previousMonth), [state.accounts, state.transactions, previousMonth])
  const trendData = useMemo(() => buildMonthlySummariesUpTo(analysisTransactions, selectedMonth), [analysisTransactions, selectedMonth])
  const budget = useMemo(() => getGastosBudgetProgress(displayAccounts, analysisTransactions, selectedMonth), [displayAccounts, analysisTransactions, selectedMonth])

  const netWorthDelta = netWorth - previousNetWorth
  const savingsRate = monthTotals.ingresos > 0 ? Math.round((monthTotals.neto / monthTotals.ingresos) * 100) : 0
  const expenseDelta = previousTotals.gastos > 0 ? Math.round(((monthTotals.gastos - previousTotals.gastos) / previousTotals.gastos) * 100) : 0
  const healthScore = Math.min(100, Math.max(0, (monthTotals.neto >= 0 ? 35 : 10) + (savingsRate >= 20 ? 30 : savingsRate > 0 ? 15 : 0) + (netWorthDelta >= 0 ? 20 : 5) + (budget && budget.progreso <= 100 ? 15 : budget ? 0 : 10)))
  const primaryInsight = monthTotals.neto >= 0
    ? savingsRate >= 20
      ? "Mes sano: estás generando margen y cumpliendo una tasa de ahorro sólida."
      : "El mes va en positivo; el siguiente paso es elevar el ahorro automático."
    : "Mes en déficit: revisa gastos variables y prioriza recortar categorías no esenciales."

  const recentTransactions = useMemo(
    () => analysisTransactions
      .filter((t) => t.fecha.startsWith(selectedMonth))
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5),
    [analysisTransactions, selectedMonth]
  )

  const topAccounts = displayAccounts.slice().sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo)).slice(0, 4)
  const goalProgress = state.sinkingFunds.length > 0
    ? Math.round(state.sinkingFunds.reduce((sum, fund) => sum + Math.min((fund.ahorrado_actual / fund.cantidad_objetivo) * 100, 100), 0) / state.sinkingFunds.length)
    : 0

  const handleCreateAccount = (account: Account) => {
    dispatch({ type: "ADD_ACCOUNT", payload: account })
    setShowNewAccount(false)
    toast("Cuenta creada", "success")
  }

  return (
    <div className="space-y-8">
      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-72" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
          <Skeleton className="h-80" />
        </div>
      ) : !hasAnyData ? (
        <>
          <EmptyWelcome onCreateAccount={() => setShowNewAccount(true)} />
          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      ) : (
        <>
          <section className="relative overflow-hidden rounded-[36px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(16,185,129,0.18),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.16),transparent_30%),radial-gradient(circle_at_75%_100%,rgba(139,92,246,0.12),transparent_30%)]" />
            <div className="relative z-10 grid gap-7 xl:grid-cols-[1.45fr_0.9fr] xl:items-end">
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />Dashboard principal
                  </span>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${netWorthDelta >= 0 ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/20" : "bg-red-500/10 text-red-500 ring-red-500/20"}`}>
                    {netWorthDelta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                    {signedMoney(netWorthDelta)} vs mes anterior
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground">{getGreeting()} · {formatMonth(selectedDate)}</p>
                  <h1 className="max-w-4xl text-[34px] font-bold leading-[0.95] tracking-tight sm:text-[48px] lg:text-[58px]">Tu dinero, en una sola lectura.</h1>
                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Patrimonio histórico, cash flow del mes, cuentas y próximos objetivos. Lo importante arriba, el detalle debajo.</p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Patrimonio neto</p>
                  <p className="text-[48px] font-bold leading-none tracking-tight tabular-nums sm:text-[68px]"><AnimatedMoney value={netWorth} /></p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-background/70 p-2.5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
                  <button onClick={() => setMonthOffset((p) => p + 1)} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes anterior"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="min-w-[165px] text-center text-sm font-bold capitalize tracking-tight">{formatMonth(selectedDate)}</span>
                  <button onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} className="rounded-xl p-2 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90" aria-label="Mes siguiente"><ChevronRight className="h-4 w-4" /></button>
                </div>

                <div className="rounded-[26px] bg-background/65 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Salud financiera</p>
                      <p className="mt-2 text-4xl font-bold tabular-nums">{healthScore}</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-500/10 p-3 ring-1 ring-emerald-500/15"><Activity className="h-5 w-5 text-emerald-500" /></div>
                  </div>
                  <Progress value={healthScore} className="mt-4 h-2" />
                  <p className="mt-3 text-sm leading-5 text-muted-foreground">{primaryInsight}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button className="gap-2 rounded-2xl" onClick={() => setShowNewAccount(true)}><Plus className="h-4 w-4" />Cuenta</Button>
                  <Link href="/analytics" className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-input bg-background px-4 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.97]"><BarChart3 className="h-4 w-4" />Analíticas</Link>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <SnapshotCard label="Ingresos" value={<AnimatedMoney value={monthTotals.ingresos} prefix="+" />} subtitle="Entradas registradas este mes" icon={ArrowUpRight} color="#10b981" delay={0} />
            <SnapshotCard label="Gastos" value={<AnimatedMoney value={monthTotals.gastos} prefix="-" />} subtitle={previousTotals.gastos > 0 ? `${expenseDelta >= 0 ? "+" : ""}${expenseDelta}% vs mes anterior` : "Sin comparativa previa"} icon={ArrowDownRight} color="#ef4444" delay={80} />
            <SnapshotCard label="Neto del mes" value={<AnimatedMoney value={monthTotals.neto} />} subtitle={monthTotals.neto >= 0 ? "Cash flow positivo" : "Cash flow negativo"} icon={CircleDollarSign} color={monthTotals.neto >= 0 ? "#3b82f6" : "#f59e0b"} delay={160} />
            <SnapshotCard label="Ahorro" value={`${Math.max(savingsRate, 0)}%`} subtitle={savingsRate >= 20 ? "Objetivo 20% alcanzado" : "Meta recomendada: 20%"} icon={Target} color={savingsRate >= 20 ? "#10b981" : "#f59e0b"} delay={240} />
          </section>

          <section className="grid grid-cols-12 gap-6">
            <SectionTitle eyebrow="Visión general" title="Tendencia y cuentas clave" text="Una vista rápida de si el mes avanza mejor que el anterior y dónde está concentrado tu patrimonio." />

            <Card className="stagger-fade col-span-full xl:col-span-7" style={{ animationDelay: "80ms" }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold"><Flame className="h-4 w-4 text-amber-500" />Evolución mensual</CardTitle>
                <span className="text-xs text-muted-foreground">Ingresos vs gastos</span>
              </CardHeader>
              <CardContent>
                {trendData.every((item) => item.ingresos === 0 && item.gastos === 0) ? (
                  <div className="flex h-[300px] flex-col items-center justify-center gap-3 rounded-2xl bg-muted/20 text-center ring-1 ring-border/20">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/35" />
                    <p className="text-sm text-muted-foreground">Añade movimientos para ver la tendencia.</p>
                  </div>
                ) : (
                  <BarChart data={trendData} index="mes" categories={["ingresos", "gastos"]} colors={["emerald", "red"]} valueFormatter={chartFormatter} yAxisWidth={72} className="h-[300px]" showAnimation />
                )}
              </CardContent>
            </Card>

            <div className="col-span-full grid gap-4 xl:col-span-5">
              <Card className="stagger-fade" style={{ animationDelay: "140ms" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><Wallet className="h-4 w-4 text-muted-foreground" />Cuentas principales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topAccounts.length === 0 ? (
                    <button onClick={() => setShowNewAccount(true)} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-muted-foreground/30 p-8 text-sm text-muted-foreground transition-all hover:border-muted-foreground/50 hover:text-foreground"><Plus className="h-4 w-4" />Nueva cuenta</button>
                  ) : (
                    topAccounts.map((account, index) => {
                      const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                      const Icon = cfg.icon
                      return (
                        <button key={account.id} onClick={() => router.push(`/cuentas/${account.id}`)} className="group flex w-full items-center justify-between gap-4 rounded-2xl bg-muted/25 p-3.5 text-left ring-1 ring-border/15 transition-all hover:-translate-y-0.5 hover:bg-muted/40 hover:shadow-sm" style={{ animationDelay: `${index * 70}ms` }}>
                          <span className="flex min-w-0 items-center gap-3">
                            <span className={`rounded-2xl bg-gradient-to-br ${cfg.tint} p-2.5 ring-1 ring-border/15`}><Icon className="h-4 w-4" style={{ color: cfg.color }} /></span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold">{account.nombre}</span>
                              <span className="block truncate text-xs text-muted-foreground">{cfg.label}{account.banco ? ` · ${account.banco}` : ""}</span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-sm font-bold tabular-nums">{formatMoney(account.saldo, account.currency)}</span>
                        </button>
                      )
                    })
                  )}
                  <Button variant="outline" className="w-full rounded-2xl" onClick={() => setShowNewAccount(true)}><Plus className="mr-2 h-4 w-4" />Añadir cuenta</Button>
                </CardContent>
              </Card>

              <Card className="stagger-fade" style={{ animationDelay: "200ms" }}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><Target className="h-4 w-4 text-blue-500" />Foco del mes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/20">
                    <p className="text-xs text-muted-foreground">Presupuesto</p>
                    {budget ? (
                      <>
                        <div className="mt-2 flex items-end justify-between gap-3">
                          <p className="text-2xl font-bold tabular-nums">{budget.progreso}%</p>
                          <p className="text-xs text-muted-foreground">{money(budget.gastado)} / {money(budget.limite)}</p>
                        </div>
                        <Progress value={budget.progreso} className="mt-3 h-2" />
                      </>
                    ) : <p className="mt-2 text-sm text-muted-foreground">Crea una cuenta de gastos con límite mensual para activar esta señal.</p>}
                  </div>
                  <div className="rounded-2xl bg-muted/30 p-4 ring-1 ring-border/20">
                    <p className="text-xs text-muted-foreground">Metas</p>
                    <p className="mt-2 text-2xl font-bold tabular-nums">{state.sinkingFunds.length > 0 ? `${goalProgress}%` : "—"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{state.sinkingFunds.length > 0 ? `${state.sinkingFunds.length} metas activas` : "Sin metas activas"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <SectionTitle eyebrow="Movimientos" title="Últimas decisiones del mes" text="El historial completo está abajo, pero aquí ves lo más reciente sin perder contexto." action={<Link href="/transactions" className="inline-flex h-9 items-center justify-center rounded-full border border-input bg-background px-4 text-sm font-medium shadow-xs transition-all hover:bg-accent hover:text-accent-foreground active:scale-[0.97]">Ver todo</Link>} />

            <Card className="stagger-fade col-span-full lg:col-span-5" style={{ animationDelay: "160ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold"><Activity className="h-4 w-4 text-muted-foreground" />Movimientos recientes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentTransactions.length === 0 ? (
                  <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/20 text-center ring-1 ring-border/20">
                    <Activity className="h-7 w-7 text-muted-foreground/35" />
                    <p className="text-sm text-muted-foreground">Sin movimientos en {formatMonth(selectedDate)}.</p>
                  </div>
                ) : recentTransactions.map((transaction) => {
                  const account = state.accounts.find((a) => a.id === transaction.cuenta_id)
                  return (
                    <div key={transaction.id} className="flex items-center justify-between gap-4 rounded-2xl bg-muted/25 p-3.5 ring-1 ring-border/15">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{transaction.descripcion || transaction.categoria}</p>
                        <p className="truncate text-xs text-muted-foreground">{new Date(transaction.fecha).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · {account?.nombre ?? "Cuenta"}</p>
                      </div>
                      <p className={`shrink-0 text-sm font-bold tabular-nums ${transaction.tipo === "ingreso" ? "text-emerald-500" : "text-red-500"}`}>{transaction.tipo === "ingreso" ? "+" : "-"}{transaction.monto.toLocaleString("es-ES")} {currencySymbol(account?.currency ?? "EUR")}</p>
                    </div>
                  )
                })}
              </CardContent>
            </Card>

            <Card className="stagger-fade col-span-full lg:col-span-7" style={{ animationDelay: "220ms" }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-semibold"><TrendingUp className="h-4 w-4 text-emerald-500" />Patrimonio histórico</CardTitle>
              </CardHeader>
              <CardContent>
                <LineChart data={[-5, -4, -3, -2, -1, 0].map((offset) => {
                  const d = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + offset, 1)
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
                  return { mes: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }), patrimonio: getNetWorthAtMonth(state.accounts, state.transactions, key) }
                })} index="mes" categories={["patrimonio"]} colors={["emerald"]} valueFormatter={chartFormatter} yAxisWidth={72} className="h-[286px]" showAnimation />
              </CardContent>
            </Card>

            <SectionTitle eyebrow="Detalle" title="Historial y metas" text="La parte operativa sigue disponible debajo, con filtros, exportación y edición." />
            <TransactionsTable selectedMonth={selectedMonth} />
            <SinkingFundsGrid />
          </section>

          <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={handleCreateAccount} />
        </>
      )}
    </div>
  )
}
