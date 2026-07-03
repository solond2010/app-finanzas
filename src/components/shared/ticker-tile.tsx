import { SparkLineChart } from "@tremor/react"

// Tarjeta compacta estilo "ticker" con un mini-gráfico de tendencia opcional
// (si no hay serie histórica disponible, como en la rentabilidad de cartera,
// se omite y solo se ve la cifra).
//
// `value` debe ser siempre la cifra (corta, protagonista); un nombre largo
// asociado (cuenta, categoría, posición) va en `detail`, que se pinta en una
// segunda línea truncable. Antes iban juntos en una línea ("Nombre · 20%") y
// en pantallas estrechas el nombre truncado dejaba restos como "Co… · 20%".
export function TickerTile({ label, value, detail, valueColor, trend, trendColor }: { label: string; value: string; detail?: string; valueColor?: string; trend?: number[]; trendColor?: string }) {
  const data = trend?.map((v, i) => ({ i, v }))
  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3.5 transition-colors card-glow">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="truncate text-lg font-bold tabular-nums" style={{ color: valueColor }}>{value}</span>
        {data && data.length > 1 && (
          <SparkLineChart data={data} index="i" categories={["v"]} colors={[trendColor ?? "blue"]} className="h-5 w-12 shrink-0" />
        )}
      </div>
      {detail && <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>}
    </div>
  )
}
