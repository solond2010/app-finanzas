import type { ReactNode } from "react"
import { TrendingDown, TrendingUp } from "@/components/icons"
import { cn } from "@/lib/utils"

/** % de cambio entre dos importes; null si no hay base con la que comparar. */
export function trendPct(current: number, previous: number): number | null {
  if (Math.abs(previous) < 0.005) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

export function formatTrendPct(pct: number): string {
  const abs = Math.abs(pct)
  return `${pct >= 0 ? "+" : "−"}${abs >= 999 ? ">999" : Math.round(abs)}\u00a0%`
}

/**
 * Píldora de tendencia: fondo suave del color semántico, icono duotono que
 * sube o baja y el texto. El color indica si es bueno o malo (gastos que
 * suben = rojo, ingresos que suben = verde…), no solo la dirección.
 */
export function TrendPill({ up, good, label, value, size = "sm", className }: {
  up: boolean
  good: boolean
  label?: ReactNode
  value: ReactNode
  size?: "xs" | "sm"
  className?: string
}) {
  const Icon = up ? TrendingUp : TrendingDown
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold tabular-nums",
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs",
        good
          ? "bg-[color-mix(in_oklab,var(--accent-green)_14%,transparent)] text-[#0B7D59] dark:text-[var(--accent-green)]"
          : "bg-[color-mix(in_oklab,var(--accent-red)_14%,transparent)] text-[#C8372A] dark:text-[var(--accent-red)]",
        className,
      )}
    >
      <Icon className={size === "xs" ? "size-3" : "size-3.5"} />
      {label && <span className="font-medium">{label}</span>}
      <span>{value}</span>
    </span>
  )
}

/** Cambio % de un importe frente al anterior como píldora (o nada si no hay base). */
export function ChangePill({ label, current, previous, lowerIsBetter = false, size }: { label: string; current: number; previous: number; lowerIsBetter?: boolean; size?: "xs" | "sm" }) {
  const pct = trendPct(current, previous)
  if (pct === null) return null
  const up = pct >= 0
  return <TrendPill up={up} good={lowerIsBetter ? !up : up} label={label} value={formatTrendPct(pct)} size={size} />
}
