"use client"

import { useMemo } from "react"
import { Sparkles, Target, TrendingUp, Wallet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SinkingFundsGrid } from "@/components/dashboard/sinking-funds"
import { useFinance } from "@/lib/store"
import { useAnimatedNumber } from "@/lib/hooks/use-animated-number"

function AnimatedNumber({ value }: { value: number }) {
  const animated = useAnimatedNumber(Math.round(value))
  return <>{animated.toLocaleString("es-ES")}</>
}

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
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[32px] bg-card/70 p-6 shadow-sm ring-1 ring-border/30 backdrop-blur-xl sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(245,158,11,0.16),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.14),transparent_30%)] dark:bg-[radial-gradient(circle_at_10%_20%,rgba(245,158,11,0.28),transparent_28%),radial-gradient(circle_at_90%_0%,rgba(59,130,246,0.24),transparent_30%)]" />
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-background/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground ring-1 ring-border/25">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Metas de ahorro
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Objetivos</p>
              <h1 className="max-w-3xl text-[34px] font-bold leading-[0.95] tracking-tight sm:text-[44px] lg:text-[52px]">Convierte metas en logros.</h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">Define objetivos, vincula cuentas y sigue tu progreso automáticamente mes a mes.</p>
            </div>
          </div>

          {hasMetas && (
            <div className="flex flex-col gap-2 rounded-[22px] bg-background/60 px-6 py-4 shadow-sm ring-1 ring-border/25 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Progreso global</p>
              <p className="text-[32px] font-bold leading-none tracking-tight tabular-nums sm:text-[38px]">
                <AnimatedNumber value={stats.overallProgress} />%
              </p>
              <p className="text-xs text-muted-foreground">
                <AnimatedNumber value={Math.round(stats.totalAhorrado)} />€ de <AnimatedNumber value={Math.round(stats.totalObjetivo)} />€
              </p>
            </div>
          )}
        </div>
      </section>

      {hasMetas && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02]" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Metas activas</span>
                <div className="rounded-2xl bg-background/60 p-2 ring-1 ring-amber-500/15">
                  <Target className="h-4 w-4 text-amber-500" />
                </div>
              </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{stats.count}</p>
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-blue-500/[0.02]" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Total ahorrado</span>
                <div className="rounded-2xl bg-background/60 p-2 ring-1 ring-blue-500/15">
                  <Wallet className="h-4 w-4 text-blue-500" />
                </div>
              </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
                <AnimatedNumber value={Math.round(stats.totalAhorrado)} />€
              </p>
            </div>
          </Card>

          <Card className="relative overflow-hidden rounded-[24px] bg-card/70 p-5 shadow-sm ring-1 ring-border/25 backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-violet-500/[0.02]" />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Objetivo total</span>
                <div className="rounded-2xl bg-background/60 p-2 ring-1 ring-violet-500/15">
                  <TrendingUp className="h-4 w-4 text-violet-500" />
                </div>
              </div>
              <p className="text-[28px] font-bold leading-none tracking-tight tabular-nums">
                <AnimatedNumber value={Math.round(stats.totalObjetivo)} />€
              </p>
            </div>
          </Card>
        </section>
      )}

      <SinkingFundsGrid />
    </div>
  )
}
