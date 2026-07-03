"use client"

import { useMemo } from "react"
import { Target, TrendingUp, Wallet } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { TickerTile } from "@/components/shared/ticker-tile"
import { useFinance } from "@/lib/store"
import { AnimatedNumber } from "@/components/shared/animated-number"
import { money } from "@/lib/format"

export default function ObjetivosPage() {
  const { state } = useFinance()

  const stats = useMemo(() => {
    const totalObjetivo = state.sinkingFunds.reduce((s, f) => s + f.cantidad_objetivo, 0)
    const totalAhorrado = state.sinkingFunds.reduce((s, f) => s + f.ahorrado_actual, 0)
    const overallProgress = totalObjetivo > 0 ? Math.round((totalAhorrado / totalObjetivo) * 100) : 0
    return { totalObjetivo, totalAhorrado, overallProgress, count: state.sinkingFunds.length }
  }, [state.sinkingFunds])

  // Meta más cerca de completarse, meta con mayor esfuerzo pendiente y nº de
  // metas ya completadas, para el ticker superior.
  const fundsWithProgress = useMemo(
    () => state.sinkingFunds.map((f) => ({ ...f, pct: f.cantidad_objetivo > 0 ? (f.ahorrado_actual / f.cantidad_objetivo) * 100 : 0, restante: Math.max(f.cantidad_objetivo - f.ahorrado_actual, 0) })),
    [state.sinkingFunds]
  )
  const completedCount = fundsWithProgress.filter((f) => f.pct >= 100).length
  const nearestFund = fundsWithProgress.filter((f) => f.pct < 100).sort((a, b) => b.pct - a.pct)[0] ?? null
  const biggestEffortFund = fundsWithProgress.filter((f) => f.pct < 100).sort((a, b) => b.restante - a.restante)[0] ?? null
  const totalRestante = Math.max(stats.totalObjetivo - stats.totalAhorrado, 0)

  const hasMetas = state.sinkingFunds.length > 0

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-section-label">Metas de ahorro</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Objetivos</h1>
          <p className="mt-1 text-sm text-muted-foreground">Define objetivos, vincula cuentas y sigue tu progreso mes a mes.</p>
        </div>
        {hasMetas && (
          <div className="flex flex-col gap-1 rounded-[16px] hero-panel px-5 py-3.5 sm:items-end">
            <p className="page-section-label">Progreso global</p>
            <p className="hero-figure text-[26px] font-bold leading-none tracking-tight tabular-nums sm:text-[30px]">
              <AnimatedNumber value={stats.overallProgress} suffix="%" />
            </p>
            <p className="text-xs text-muted-foreground">
              <AnimatedNumber value={Math.round(stats.totalAhorrado)} /> de <AnimatedNumber value={Math.round(stats.totalObjetivo)} />
            </p>
          </div>
        )}
      </header>

      {hasMetas && (
        <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <TickerTile label="Restante total" value={money(totalRestante)} valueColor="var(--accent-amber)" />
          <TickerTile label="Meta más cerca" value={nearestFund ? `${Math.round(nearestFund.pct)}%` : "—"} detail={nearestFund?.nombre} valueColor="var(--accent-green)" />
          <TickerTile label="Mayor esfuerzo" value={biggestEffortFund ? money(biggestEffortFund.restante) : "—"} detail={biggestEffortFund?.nombre} valueColor="var(--gold)" />
          <TickerTile label="Completadas" value={`${completedCount}/${stats.count}`} valueColor="var(--primary)" />
        </section>
      )}

      {hasMetas && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Metas activas"
            value={stats.count}
            subtitle="Objetivos en curso"
            icon={Target}
            tone="amber"
            delay={0}
          />
          <MetricCard
            label="Total ahorrado"
            value={<AnimatedNumber value={Math.round(stats.totalAhorrado)} />}
            subtitle="Acumulado de todas las metas"
            icon={Wallet}
            tone="blue"
            delay={80}
          />
          <MetricCard
            label="Objetivo total"
            value={<AnimatedNumber value={Math.round(stats.totalObjetivo)} />}
            subtitle="Suma de todas las metas"
            icon={TrendingUp}
            tone="violet"
            delay={160}
          />
        </section>
      )}

      <SinkingFundsGrid />
    </div>
  )
}
