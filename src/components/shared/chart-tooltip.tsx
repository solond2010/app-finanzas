import type { CustomTooltipProps } from "@tremor/react"

const TREMOR_HEX: Record<string, string> = {
  blue: "#3f6bff",
  emerald: "#10b981",
  red: "#ef4444",
  amber: "#f59e0b",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  rose: "#f43f5e",
  gray: "#6b7387",
  indigo: "#6366f1",
  sky: "#0ea5e9",
  slate: "#64748b",
}

function defaultFormatter(v: number) {
  return `${Math.round(v).toLocaleString("es-ES")}€`
}

/**
 * Tremor solo pasa {active,payload,label} al customTooltip (no hay forma de
 * inyectar props extra), así que el color por categoría se resuelve al
 * crear el componente, cerrando sobre los mismos arrays `categories`/`colors`
 * que ya se le pasan al gráfico — para que nunca se desincronicen del tema
 * real de la app en vez de usar la paleta genérica de Tremor.
 */
export function createChartTooltip(categories: string[], colors: string[], formatter: (v: number) => string = defaultFormatter) {
  const colorByCategory: Record<string, string> = {}
  categories.forEach((c, i) => { colorByCategory[c] = TREMOR_HEX[colors[i]] ?? TREMOR_HEX.blue })

  return function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload || payload.length === 0) return null
    return (
      <div className="min-w-[130px] rounded-xl border border-border bg-popover p-3 shadow-lg">
        {/* En un donut, label y el único item del payload son el mismo nombre de
            segmento — omitir la cabecera para no repetirlo dos veces. */}
        {label !== undefined && !payload.every((p) => String(p.name ?? p.dataKey ?? "") === String(label)) && (
          <p className="mb-2 text-[11px] capitalize text-muted-foreground">{String(label)}</p>
        )}
        <div className="space-y-1.5">
          {payload.map((item, i) => {
            const name = String(item.name ?? item.dataKey ?? "")
            const value = typeof item.value === "number" ? formatter(item.value) : String(item.value)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: colorByCategory[name] ?? TREMOR_HEX.gray }} />
                <span className="flex-1 truncate text-muted-foreground">{name}</span>
                <span className="font-semibold tabular-nums text-foreground">{value}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }
}
