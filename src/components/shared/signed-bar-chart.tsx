"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Barras de cambio con signo: subida en verde hacia arriba y bajada en rojo
// hacia abajo desde la línea de cero (paleta Garra). Sustituye a un BarChart
// apilado de Tremor que pintaba subidas en rojo y montaba las etiquetas del
// eje X en móvil.
export function SignedBarChart({ data, valueFormatter, axisFormatter = valueFormatter, className, ariaLabel }: {
  data: { label: string; value: number; detail?: string }[]
  valueFormatter: (value: number) => string
  axisFormatter?: (value: number) => string
  className?: string
  ariaLabel: string
}) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(0, ...data.map((d) => d.value))
  const min = Math.min(0, ...data.map((d) => d.value))
  // Escala "redonda" (500, 1.000, 2.500…) para que el eje no muestre
  // céntimos como "1.445,94 €".
  const rawStep = (max - min) / 3 || 1
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = ([1, 2, 2.5, 5, 10].find((f) => f * magnitude >= rawStep) ?? 10) * magnitude
  const top = Math.max(step, Math.ceil(max / step) * step)
  const bottom = Math.floor(min / step) * step
  const span = top - bottom || 1
  const zero = (top / span) * 100
  const ticks: number[] = []
  for (let t = top; t >= bottom - step / 2; t -= step) ticks.push(Math.round(t))
  // Etiquetas del eje: si todas son del mismo año basta con el mes; en móvil
  // se muestra como mucho una de cada `step` para que no se monten.
  const years = new Set(data.map((d) => d.label.split(" ")[1] ?? ""))
  const shortLabel = (label: string) => (years.size <= 1 ? label.split(" ")[0] : label)
  const labelStep = Math.max(1, Math.ceil(data.length / 6))
  const shown = active !== null ? data[active] : null

  return (
    <div className={cn("w-full", className)}>
      <div className="mb-2 min-h-5 text-xs" aria-live="polite">
        {shown ? (
          <span><span className="font-medium text-foreground">{shown.detail ?? shown.label}</span> · <span className={cn("font-semibold tabular-nums", shown.value >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]")}>{shown.value >= 0 ? "+" : "−"}{valueFormatter(Math.abs(shown.value))}</span></span>
        ) : <span className="text-muted-foreground">Toca o pasa por una barra para ver el cambio.</span>}
      </div>
      <div className="flex gap-2" role="img" aria-label={`${ariaLabel}: ${data.map((d) => `${d.label} ${d.value >= 0 ? "+" : "−"}${valueFormatter(Math.abs(d.value))}`).join(", ")}`}>
        <div className="relative w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground sm:w-14 sm:text-xs" aria-hidden="true">
          {ticks.map((tick, i) => (
            <span key={i} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${((top - tick) / span) * 100}%` }}>{axisFormatter(tick)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {ticks.map((tick, i) => <span key={i} aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-border/70" style={{ top: `${((top - tick) / span) * 100}%` }} />)}
          <span aria-hidden="true" className="absolute inset-x-0 border-t border-foreground/25" style={{ top: `${zero}%` }} />
          <div className="absolute inset-0 flex items-stretch gap-1.5 sm:gap-3">
            {data.map((d, i) => {
              const h = (Math.abs(d.value) / span) * 100
              return (
                <button
                  key={d.label}
                  type="button"
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null) }}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-label={`${d.label}: ${d.value >= 0 ? "+" : "−"}${valueFormatter(Math.abs(d.value))}`}
                  className="relative min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    aria-hidden="true"
                    className={cn("absolute left-1/2 w-[min(100%,3rem)] -translate-x-1/2 transition-opacity", d.value >= 0 ? "rounded-t-md" : "rounded-b-md", active !== null && active !== i && "opacity-45")}
                    style={{ top: d.value >= 0 ? `${zero - h}%` : `${zero}%`, height: `max(${h}%, ${d.value === 0 ? 0 : 2}px)`, backgroundColor: d.value >= 0 ? "var(--accent-green)" : "var(--accent-red)" }}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2" aria-hidden="true">
        <span className="w-12 shrink-0 sm:w-14" />
        <div className="flex min-w-0 flex-1 gap-1.5 sm:gap-3">
          {data.map((d, i) => (
            <span key={d.label} className={cn("min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground sm:text-xs", i % labelStep !== 0 && i !== data.length - 1 && "max-sm:invisible")}>{shortLabel(d.label)}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
