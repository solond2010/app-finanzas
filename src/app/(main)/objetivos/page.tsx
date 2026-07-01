"use client"

import { useMemo } from "react"
import { Sparkles, Target, TrendingUp, Wallet } from "lucide-react"
import { MetricCard } from "@/components/dashboard/metric-card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { useFinance } from "@/lib/store"
import { AnimatedNumber } from "@/components/shared/animated-number"

export default function ObjetivosPage() {
  const { state } = useFinance()

  const stats = useMemo(() => {
    const totalObjetivo = state.sinkingFunds.reduce((s, f) => s + f.cantidad_objetivo, 0)
    const totalAhorrado = state.sinkingFunds.reduce((s, f) => s + f.ahorrado_actual, 0)
    const overallProgress = totalObjetivo > 0 ? Math.round((totalAhorrado / totalObjetivo) * 100) : 0
    return { totalObjetivo, totalAhorrado, overallProgress, count: state.sinkingFunds.length }
  }, [state.sinkingFunds])

  const hasMetas = state.sinkingFunds.length > 0

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <section className="hero-gradient rounded-[24px] bg-card/70 p-6 card-glow sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              Metas de ahorro
            </div>
            <div className="space-y-2">
              <p className="page-section-label">Objetivos</p>
              <h1 className="max-w-3xl text-2xl font-bold leading-tight tracking-tight sm:text-3xl">Convierte metas en logros.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Define objetivos, vincula cuentas y sigue tu progreso automáticamente mes a mes.</p>
            </div>
          </div>

          {hasMetas && (
            <div className="flex flex-col gap-2 rounded-[22px] bg-background/60 px-6 py-4 card-glow">
              <p className="page-section-label">Progreso global</p>
              <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-[38px]">
                <AnimatedNumber value={stats.overallProgress} suffix="%" />
              </p>
              <p className="text-xs text-muted-foreground">
                <AnimatedNumber value={Math.round(stats.totalAhorrado)} /> de <AnimatedNumber value={Math.round(stats.totalObjetivo)} />
              </p>
            </div>
          )}
        </div>
      </section>

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
