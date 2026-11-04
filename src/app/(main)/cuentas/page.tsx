"use client"

import { useRouter } from "next/navigation"
import { useFinance, type Account, type SinkingFund } from "@/lib/store"
import { accountGoal, fundCurrentAmount } from "@/lib/calculations"
import { accountColor } from "@/lib/account-colors"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { Wallet as WalletIcon, Plus, Target, TrendingUp, Search, ChevronDown, ChevronsDownUp, ChevronsUpDown, Building2, ChevronRight, EyeOff } from "@/components/icons"
import { formatMoney, convertToEur } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { typeConfig } from "@/lib/account-types"
import { AccountLogo } from "@/components/dashboard/account-logo"
import { useEffect, useMemo, useState } from "react"
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
  // Pestañas Cuentas | Metas. "#metas" en la URL abre directamente la de metas.
  const [tab, setTab] = useState<"cuentas" | "metas">("cuentas")
  useEffect(() => {
    if (window.location.hash === "#metas") queueMicrotask(() => setTab("metas"))
    // «#nueva» (desde la guía de bienvenida) abre directamente «Nueva cuenta».
    if (window.location.hash === "#nueva") {
      queueMicrotask(() => setShowNewAccount(true))
      try { window.history.replaceState(null, "", window.location.pathname) } catch {}
    }
    // «?tipo=inversion» (p. ej. desde Composición del Resumen) abre ya filtrado.
    const requestedType = new URLSearchParams(window.location.search).get("tipo")
    if (requestedType && requestedType in typeConfig) queueMicrotask(() => setAccountType(requestedType))
  }, [])
  const selectTab = (next: "cuentas" | "metas") => {
    setTab(next)
    try { window.history.replaceState(null, "", next === "metas" ? "#metas" : window.location.pathname) } catch {}
  }
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
    for (const account of visibleAccounts.filter((a) => !isZero(a))) {
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
      .sort((a, b) => b.accounts.reduce((s, x) => s + accountValueEur(x), 0) - a.accounts.reduce((s, x) => s + accountValueEur(x), 0))
  }, [visibleAccounts]) // eslint-disable-line react-hooks/exhaustive-deps
  // Reparto por tipo real de cada cuenta (solo saldos positivos).
  const typeSplit = useMemo(() => Object.entries(typeConfig).map(([tipo, cfg]) => ({ tipo, label: cfg.label, color: cfg.color, value: state.accounts.filter((a) => a.tipo === tipo).reduce((sum, a) => sum + Math.max(0, accountValueEur(a)), 0) })).filter((t) => t.value > 0.005), [state.accounts]) // eslint-disable-line react-hooks/exhaustive-deps
  const isZero = (a: Account) => Math.abs(a.saldo) < 0.005
  const zeroAccounts = visibleAccounts.filter(isZero)
  const [zeroOpen, setZeroOpen] = useState(false)
  const filtersActive = Boolean(accountSearch.trim()) || accountType !== "all"
  const allGroupsExpanded = accountGroups.length > 0 && accountGroups.every((group) => groupOpenState[group.key] ?? true)
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Cuentas</h1>
          <p className="mt-1 text-sm text-muted-foreground">{state.accounts.length} {state.accounts.length === 1 ? "cuenta" : "cuentas"} · saldos por banco y metas de ahorro.</p>
        </div>
        <button type="button" onClick={() => setShowNewAccount(true)} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 self-start rounded-full bg-[var(--gold)] px-4 text-sm font-bold text-[var(--gold-foreground)] shadow-sm transition-[filter,transform] hover:brightness-110 active:scale-[0.98] sm:self-auto">
          <Plus className="size-4" />Nueva cuenta
        </button>
      </header>

      <div role="tablist" aria-label="Secciones de Cuentas" className="inline-flex rounded-full bg-muted/60 p-1 text-sm font-semibold">
        {([["cuentas", "Cuentas"], ["metas", "Metas"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => selectTab(key)} className={`min-h-10 rounded-full px-5 transition-colors ${tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {label}{key === "metas" && hasMetas ? ` · ${state.sinkingFunds.length}` : ""}
          </button>
        ))}
      </div>

      {tab === "cuentas" && (loading ? (
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
          <section aria-label="Total en cuentas" className="rounded-[18px] border border-border bg-card p-4 sm:p-5">
            <p className="page-section-label">Total en cuentas</p>
            <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight tabular-nums sm:text-[32px]"><Sensitive as="span"><AnimatedNumber value={netWorth} /></Sensitive></p>
            {typeSplit.length > 0 && <>
              <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                {typeSplit.map((t) => <span key={t.tipo} style={{ flexGrow: t.value, background: t.color }} />)}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground sm:text-sm">
                {typeSplit.map((t) => <li key={t.tipo} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: t.color }} />{t.label} <Sensitive className="font-semibold text-foreground">{formatMoney(t.value, "EUR")}</Sensitive>{netWorth > 0 && <span>· {Math.round((t.value / netWorth) * 100)} %</span>}</li>)}
              </ul>
            </>}
          </section>

          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={accountSearch} onChange={(e) => setAccountSearch(e.target.value)} placeholder="Buscar cuenta o banco…" className="pl-9" /></div>
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)} aria-label="Filtrar cuentas por tipo" className="h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground sm:h-10 sm:w-auto">
              <option value="all">Todos los tipos</option>{Object.entries(typeConfig).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <p className="text-xs text-muted-foreground">{filtersActive ? `${visibleAccounts.length} ${visibleAccounts.length === 1 ? "cuenta encontrada" : "cuentas encontradas"}` : `${accountGroups.length} ${accountGroups.length === 1 ? "grupo" : "grupos"}`}</p>
            {accountGroups.length > 1 && <button type="button" onClick={toggleAllGroups} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground">{allGroupsExpanded ? <><ChevronsDownUp className="h-3.5 w-3.5" /> Contraer grupos</> : <><ChevronsUpDown className="h-3.5 w-3.5" /> Expandir grupos</>}</button>}
          </div>
          <div className="min-w-0 divide-y divide-border/70 overflow-hidden rounded-[18px] border border-border bg-card">
            {accountGroups.map((group, index) => {
              const isOpen = groupOpenState[group.key] ?? index === 0
              const groupValue = group.accounts.reduce((sum, account) => sum + accountValueEur(account), 0)
                            // Solo se habla de «aproximado» si hay que convertir otra divisa.
              const mixedCurrency = group.accounts.some((account) => (account.currency ?? "EUR") !== "EUR")
              return (
                <section key={group.key} className="min-w-0">
                  <button type="button" aria-expanded={isOpen} onClick={() => setGroupOpenState((current) => ({ ...current, [group.key]: !isOpen }))} className="flex min-h-[68px] w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/25 sm:px-5">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-background/70 text-muted-foreground">{group.accounts[0].banco ? <AccountLogo account={group.accounts[0]} className="h-10 w-10 rounded-xl" /> : <Building2 className="h-5 w-5" />}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground sm:text-base">{group.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground"><span>{group.accounts.length} {group.accounts.length === 1 ? "cuenta" : "cuentas"}</span></span>
                    </span>
                    <span className="shrink-0 text-right">
                      {mixedCurrency && <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Total aprox.</span>}
                      <span className="mt-0.5 block text-sm font-bold tabular-nums text-foreground sm:text-base"><Sensitive>{formatMoney(groupValue, "EUR")}</Sensitive></span>
                    </span>
                    <ChevronDown className={`ml-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && <div className="border-t border-border/70 bg-background/35 px-3 py-1.5 sm:px-4">
                    {group.accounts.map((account, accountIndex) => {
                      const cfg = typeConfig[account.tipo] ?? typeConfig.efectivo
                      return <button key={account.id} type="button" onClick={() => router.push(`/cuentas/${account.id}`)} className={`group/row relative flex min-h-[68px] w-full min-w-0 items-center gap-3 rounded-xl py-2 pl-3.5 pr-2 text-left transition-colors hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${accountIndex > 0 ? "border-t border-border/40" : ""}`}>
                        <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ backgroundColor: cfg.color }} />
                        <AccountLogo account={account} className="h-10 w-10 shrink-0 rounded-xl" />
                        <span className="min-w-0 flex-1"><span className="line-clamp-2 break-words text-sm font-medium leading-tight text-foreground">{account.nombre}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{cfg.label}</span></span>
                        <span className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums text-foreground"><Sensitive>{formatMoney(accountValue(account), account.currency)}</Sensitive></span>{(account.currency ?? "EUR") !== "EUR" && <span className="mt-0.5 block text-[10px] text-muted-foreground">{account.currency}</span>}</span>
                        <ChevronRight className="ml-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover/row:text-primary" />
                      </button>
                    })}
                    {mixedCurrency && <p className="px-2 pb-1 pt-2 text-[10px] text-muted-foreground">Total aproximado convertido a euros</p>}
                  </div>}
                </section>
              )
            })}
            {visibleAccounts.length === 0 && (
              <div className="px-4 py-8">
                <EmptyState
                  icon={Search}
                  title="No hay cuentas que coincidan"
                  description="Prueba otro nombre o tipo de cuenta."
                  action={{ label: "Limpiar búsqueda", onClick: () => { setAccountSearch(""); setAccountType("all") } }}
                />
              </div>
            )}
            {zeroAccounts.length > 0 && (
              <section className="min-w-0">
                <button type="button" aria-expanded={zeroOpen} onClick={() => setZeroOpen(!zeroOpen)} className="flex min-h-[60px] w-full items-center gap-3 px-4 py-3 text-left text-muted-foreground transition-colors hover:bg-muted/25 sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted"><EyeOff className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cuentas a 0 € ({zeroAccounts.length})</span><span className="block truncate text-[11px]">{zeroAccounts.map((a) => a.banco?.trim() || a.nombre).join(" · ")}</span></span>
                  <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${zeroOpen ? "rotate-180" : ""}`} />
                </button>
                {zeroOpen && <div className="border-t border-border/70 bg-background/35 px-3 py-1.5 sm:px-4">
                  {zeroAccounts.map((account) => (
                    <button key={account.id} type="button" onClick={() => router.push(`/cuentas/${account.id}`)} className="relative flex min-h-[56px] w-full min-w-0 items-center gap-3 rounded-xl py-2 pl-3.5 pr-2 text-left hover:bg-muted/45">
                      <span aria-hidden="true" className="absolute inset-y-3 left-0 w-1 rounded-full" style={{ backgroundColor: (typeConfig[account.tipo] ?? typeConfig.efectivo).color }} />
                      <AccountLogo account={account} className="h-9 w-9 shrink-0 rounded-xl" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{account.nombre}</span><span className="block truncate text-xs text-muted-foreground">{account.banco || (typeConfig[account.tipo]?.label ?? "Cuenta")}</span></span>
                      <span className="text-sm tabular-nums text-muted-foreground"><Sensitive>{formatMoney(0, account.currency)}</Sensitive></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>}
              </section>
            )}
          </div>
        </>
      ))}

      {tab === "metas" && <section className="space-y-6 sm:space-y-7">
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
      </section>}

      <AccountDialog open={showNewAccount} onOpenChange={setShowNewAccount} onSave={(a) => { dispatch({ type: "ADD_ACCOUNT", payload: a }); setShowNewAccount(false); toast("Cuenta creada", "success") }} />
    </div>
  )
}
