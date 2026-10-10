"use client"

import { useRouter } from "next/navigation"
import { useFinance, type Account, type SinkingFund } from "@/lib/store"
import { accountGoal, fundCurrentAmount } from "@/lib/calculations"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Wallet as WalletIcon, Plus, Target, TrendingUp, Search, ChevronDown, ChevronsDownUp, ChevronsUpDown, Building2, ArrowUpRight } from "lucide-react"
import { formatMoney, convertToEur } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { typeConfig } from "@/lib/account-types"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { AccountDialog } from "@/components/dashboard/account-dialog"
import { useToast } from "@/components/ui/toast"
import { TickerTile } from "@/components/shared/ticker-tile"
import { EmptyState } from "@/components/shared/empty-state"
import { Skeleton } from "@/components/shared/skeleton"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { money } from "@/lib/format"

export default function CuentasPage() {
  const { state, loading, dispatch } = useFinance()
  const router = useRouter()
  const { toast } = useToast()
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [accountSearch, setAccountSearch] = useState("")
  const [accountType, setAccountType] = useState("all")
  const [groupOpenState, setGroupOpenState] = useState<Record<string, boolean>>({})
  // El saldo manual de cada cuenta es la única fuente de verdad.
  // No se estiman cambios de mercado dentro de la app.
  const accountValue = (a: Account) => a.saldo
  // Para sumar o comparar entre cuentas hace falta pasar todo a la misma
  // divisa primero (ej. la cuenta de Suiza en CHF); accountValue por sí solo
  // da el valor en la divisa propia de la cuenta, válido solo para mostrar
  // una cuenta individual, no para totales conjuntos.
  const accountValueEur = (a: Account) => convertToEur(accountValue(a), a.currency)
  const netWorth = state.accounts.reduce((s, a) => s + accountValueEur(a), 0)
  const visibleAccounts = state.accounts.filter((a) => (accountType === "all" || a.tipo === accountType) && `${a.nombre} ${a.banco ?? ""}`.toLowerCase().includes(accountSearch.trim().toLowerCase()))
  const accountGroups = useMemo(() => {
    const groups = new Map<string, { title: string; accounts: Account[] }>()
    for (const account of visibleAccounts) {
      const rawBank = account.banco?.trim()
      // Algunos registros antiguos guardan "Revolut Conjunta" como si fuera
      // otra entidad. Agrupamos por marca sin reescribir los datos guardados.
      const isRevolut = /^revolut\b/i.test(rawBank ?? "")
      const bank = isRevolut ? "Revolut" : rawBank
      const kind = typeConfig[account.tipo]?.label ?? "Cuenta"
      const key = isRevolut ? "bank:revolut" : bank ? `bank:${bank.toLocaleLowerCase("es-ES")}` : `type:${account.tipo}`
      const title = bank || `${kind} · Sin entidad`
      const group = groups.get(key) ?? { title, accounts: [] }
      group.accounts.push(account)
      groups.set(key, group)
    }
    return [...groups.entries()].map(([key, group]) => ({ key, ...group }))
      .sort((a, b) => a.title.localeCompare(b.title, "es"))
  }, [visibleAccounts])
  const filtersActive = Boolean(accountSearch.trim()) || accountType !== "all"
  const allGroupsExpanded = accountGroups.length > 0 && accountGroups.every((group) => groupOpenState[group.key] ?? filtersActive)
  const toggleAllGroups = () => setGroupOpenState((current) => ({ ...current, ...Object.fromEntries(accountGroups.map((group) => [group.key, !allGroupsExpanded])) }))

  // Cuenta con mayor saldo y cuenta más cerca de completar su objetivo, para
  // el ticker superior (solo cuando hay cuentas registradas).
  const topAccount = useMemo(() => (state.accounts.length === 0 ? null : state.accounts.slice().sort((a, b) => accountValueEur(b) - accountValueEur(a))[0]), [state.accounts]) // eslint-disable-line react-hooks/exhaustive-deps
  const nearestGoal = useMemo(() => {
    return state.accounts
      .map((a) => ({ account: a, goal: accountGoal(a, state.sinkingFunds) }))
      .filter((a) => a.goal > 0)
      .map((a) => ({ account: a.account, pct: Math.min((accountValue(a.account) / a.goal) * 100, 100) }))
      .sort((a, b) => b.pct - a.pct)[0] ?? null
  }, [state.accounts, state.sinkingFunds])
  const liquidNetWorth = state.accounts.filter((a) => a.tipo !== "inversion").reduce((s, a) => s + accountValueEur(a), 0)
  const liquidPct = netWorth > 0 ? Math.round((liquidNetWorth / netWorth) * 100) : 0

  // Metas de ahorro (fusionado desde /objetivos): mismos cálculos que tenía esa página.
  // El objetivo de una meta está en la divisa de su cuenta vinculada (ej. una
  // meta en la cuenta de Suiza está en CHF): hay que convertir antes de sumar
  // objetivos/ahorrado de metas en distintas cuentas/divisas.
  const goalStats = useMemo(() => {
    const fundCurrency = (f: SinkingFund) => state.accounts.find((a) => a.id === f.cuenta_id)?.currency ?? "EUR"
    const totalObjetivo = state.sinkingFunds.reduce((s, f) => s + convertToEur(f.cantidad_objetivo, fundCurrency(f)), 0)
    const totalAhorrado = state.sinkingFunds.reduce((s, f) => s + convertToEur(fundCurrentAmount(f, state.accounts), fundCurrency(f)), 0)
    const overallProgress = totalObjetivo > 0 ? Math.round((totalAhorrado / totalObjetivo) * 100) : 0
    return { totalObjetivo, totalAhorrado, overallProgress, count: state.sinkingFunds.length }
  }, [state.sinkingFunds, state.accounts])
  const fundsWithProgress = useMemo(
    () => state.sinkingFunds.map((f) => {
      const ahorradoActual = fundCurrentAmount(f, state.accounts)
      return { ...f, pct: f.cantidad_objetivo > 0 ? (ahorradoActual / f.cantidad_objetivo) * 100 : 0, restante: Math.max(f.cantidad_objetivo - ahorradoActual, 0) }
    }),
    [state.sinkingFunds, state.accounts]
  )
  const completedGoals = fundsWithProgress.filter((f) => f.pct >= 100).length
  const nearestGoalFund = fundsWithProgress.filter((f) => f.pct < 100).sort((a, b) => b.pct - a.pct)[0] ?? null
  const biggestEffortFund = fundsWithProgress.filter((f) => f.pct < 100).sort((a, b) => b.restante - a.restante)[0] ?? null
  const totalRestante = Math.max(goalStats.totalObjetivo - goalStats.totalAhorrado, 0)
  const hasMetas = state.sinkingFunds.length > 0

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-section-label">Patrimonio</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Saldos, bancos y progreso de objetivos en un vistazo.</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-4 rounded-[18px] hero-panel px-4 py-3.5 sm:flex-col sm:items-end sm:px-5">
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
            <TickerTile label="Cuenta líder" value={topAccount ? <Sensitive>{formatMoney(accountValue(topAccount), topAccount.currency)}</Sensitive> : "—"} detail={topAccount?.nombre} valueColor="var(--gold)" />
            <TickerTile label="Objetivo más cerca" value={nearestGoal ? `${Math.round(nearestGoal.pct)}%` : "—"} detail={nearestGoal?.account.nombre} valueColor="var(--accent-green)" />
            <TickerTile label="Liquidez" value={`${liquidPct}%`} valueColor="var(--accent-blue)" />
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Buscar cuenta o banco…" className="pl-9" /></div>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} aria-label="Filtrar cuentas por tipo" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground sm:h-10 sm:w-auto">
              <option value="all">Todos los tipos</option>{Object.entries(typeConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs text-muted-foreground">{visibleAccounts.length} {visibleAccounts.length === 1 ? "cuenta" : "cuentas"}{filtersActive ? " encontradas" : ` · ${accountGroups.length} grupos`}</p>
            {accountGroups.length > 1 && <button type="button" onClick={toggleAllGroups} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">{allGroupsExpanded ? <><ChevronsDownUp className="h-3.5 w-3.5" /> Contraer grupos</> : <><ChevronsUpDown className="h-3.5 w-3.5" /> Expandir grupos</>}</button>}
          </div>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3 sm:gap-4">
            {accountGroups.map((group, index) => {
              const isOpen = groupOpenState[group.key] ?? filtersActive
              const groupValue = group.accounts.reduce((sum, account) => sum + accountValueEur(account), 0)
              const kinds = [...new Set(group.accounts.map((account) => typeConfig[account.tipo]?.label ?? "Cuenta"))]
              return (
                <section key={group.key} className="account-group-card stagger-fade min-w-0 overflow-hidden rounded-[18px] border border-border bg-card/90 shadow-sm transition-colors" style={{ animationDelay: `${index * 45}ms` }}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setGroupOpenState((current) => ({ ...current, [group.key]: !isOpen }))} className="flex min-h-[96px] w-full min-w-0 items-center gap-3 p-4 text-left transition-colors hover:bg-muted/25 sm:min-h-[104px] sm:p-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-muted-foreground">{group.accounts[0].banco ? <AccountLogo account={group.accounts[0]} className="h-10 w-10 rounded-xl" /> : <Building2 className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground sm:text-base">{group.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{group.accounts.length} {group.accounts.length === 1 ? "cuenta" : "cuentas"}</span>{kinds.map((kind) => <span key={kind} className="rounded-full bg-background/70 px-1.5 py-0.5">{kind}</span>)}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Total aprox.</span>
                      <span className="mt-0.5 block text-sm font-bold tabular-nums text-foreground sm:text-base"><Sensitive>{formatMoney(groupValue, "EUR")}</Sensitive></span>
                    </span>
                    <ChevronDown className={`ml-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <div className="border-t border-border/70 px-3 py-2 sm:px-4">
                    {group.accounts.map((account, accountIndex) => {
                      const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                      return <button key={account.id} type="button" onClick={() => router.push(`/cuentas/${account.id}`)} className={`group/row flex min-h-[68px] w-full min-w-0 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${accountIndex > 0 ? "border-t border-border/40" : ""}`}>
                        <AccountLogo account={account} className="h-10 w-10 shrink-0 rounded-xl" />
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{account.nombre}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{account.banco || cfg.label} · {cfg.label}</span></span>
                        <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums text-foreground"><Sensitive>{formatMoney(accountValue(account), account.currency)}</Sensitive></span><span className="mt-0.5 block text-[10px] text-muted-foreground">{account.currency}</span></span>
                        <ArrowUpRight className="ml-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-primary" />
                      </button>
                    })}
                    <p className="px-2 pb-1 pt-2 text-[10px] text-muted-foreground">Total aproximado convertido a euros</p>
                  </div>}
                </section>
              )
            })}
            {visibleAccounts.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-border px-4 py-8">
                <EmptyState
                  icon={Search}
                  title="No hay cuentas que coincidan"
                  description="Prueba otro nombre o tipo de cuenta."
                  action={{ label: "Limpiar búsqueda", onClick: () => { setAccountSearch(""); setAccountType("all") } }}
                />
              </div>
            )}
            <button
              onClick={() => setShowNewAccount(true)}
              className="stagger-fade flex min-h-[104px] items-center justify-center gap-3 rounded-[18px] border border-dashed border-muted-foreground/25 p-5 text-muted-foreground transition-colors hover:border-[color-mix(in_oklch,var(--gold),transparent_40%)] hover:bg-[color-mix(in_oklch,var(--gold),transparent_94%)] hover:text-foreground"
              style={{ animationDelay: `${state.accounts.length * 60}ms` }}
            >
              <Plus className="h-5 w-5" />
              <span className="text-sm font-medium">Nueva Cuenta</span>
            </button>
          </div>
        </>
      )}

      <section className="space-y-6 border-t border-border pt-6 sm:space-y-7 sm:pt-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-section-label">Metas de ahorro</p>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Objetivos</h2>
            <p className="mt-1 text-sm text-muted-foreground">Define objetivos, vincula cuentas y sigue tu progreso mes a mes.</p>
          </div>
          {hasMetas && (
            <div className="flex items-center gap-2 self-start rounded-full border border-border bg-card px-4 py-2 sm:self-auto">
              <span className="text-xs text-muted-foreground">Progreso global</span>
              <span className="text-sm font-bold tabular-nums text-foreground"><AnimatedNumber value={goalStats.overallProgress} suffix="%" /></span>
            </div>
          )}
        </div>

        {hasMetas && (
          <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <TickerTile label="Restante total" value={<Sensitive>{money(totalRestante)}</Sensitive>} valueColor="var(--accent-amber)" />
            <TickerTile label="Meta más cerca" value={nearestGoalFund ? `${Math.round(nearestGoalFund.pct)}%` : "—"} detail={nearestGoalFund?.nombre} valueColor="var(--accent-green)" />
            <TickerTile label="Mayor esfuerzo" value={biggestEffortFund ? <Sensitive>{money(biggestEffortFund.restante)}</Sensitive> : "—"} detail={biggestEffortFund?.nombre} valueColor="var(--gold)" />
            <TickerTile label="Completadas" value={`${completedGoals}/${goalStats.count}`} valueColor="var(--primary)" />
          </section>
        )}

        {hasMetas && (
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard label="Metas activas" value={goalStats.count} subtitle="Objetivos en curso" icon={Target} tone="amber" delay={0} />
            <MetricCard label="Total ahorrado" value={<AnimatedNumber value={Math.round(goalStats.totalAhorrado)} />} subtitle="Acumulado de todas las metas" icon={WalletIcon} tone="blue" delay={80} />
            <MetricCard label="Objetivo total" value={<AnimatedNumber value={Math.round(goalStats.totalObjetivo)} />} subtitle="Suma de todas las metas" icon={TrendingUp} tone="violet" delay={160} />
          </section>
        )}

        <SinkingFundsGrid />
      </section>

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={(a) => { dispatch({ type: "ADD_ACCOUNT", payload: a }); setShowNewAccount(false); toast("Cuenta creada", "success") }} />
    </div>
  )
}
