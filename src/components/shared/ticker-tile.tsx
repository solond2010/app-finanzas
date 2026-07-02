import { SparkLineChart } from "@tremor/react"

// Tarjeta compacta estilo "ticker" con un mini-gráfico de tendencia opcional
// (si no hay serie histórica disponible, como en la rentabilidad de cartera,
// se omite y solo se ve la cifra).
export function TickerTile({ label, value, valueColor, trend, trendColor }: { label: string; value: string; valueColor?: string; trend?: number[]; trendColor?: string }) {
  const data = trend?.map((v, i) => ({ i, v }))
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3.5 transition-all duration-300 ease-out hover:-translate-y-0.5 card-glow">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="truncate text-lg font-bold tabular-nums" style={{ color: valueColor }}>{value}</span>
        {data && data.length > 1 && (
          <SparkLineChart data={data} index="i" categories={["v"]} colors={[trendColor ?? "blue"]} className="h-5 w-12 shrink-0" />
        )}
      </div>
    </div>
  )
}
