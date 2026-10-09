import type { ReactNode } from "react"
import { SparkLineChart } from "@tremor/react"
import { ArrowUpRight } from "lucide-react"

// Tarjeta compacta estilo "ticker" con un mini-gráfico de tendencia opcional
// (si no hay serie histórica disponible, como en la rentabilidad de cartera,
// se omite y solo se ve la cifra).
//
// `value` debe ser siempre la cifra (corta, protagonista); un nombre largo
// asociado (cuenta, categoría, posición) va en `detail`, que se pinta en una
// segunda línea truncable. Antes iban juntos en una línea ("Nombre · 20%") y
// en pantallas estrechas el nombre truncado dejaba restos como "Co… · 20%".
export function TickerTile({ label, value, detail, detailTone, secondaryDetail, valueColor, trend, trendColor, onClick }: { label: string; value: ReactNode; detail?: ReactNode; detailTone?: "positive" | "negative" | "neutral"; secondaryDetail?: ReactNode; valueColor?: string; trend?: number[]; trendColor?: string; onClick?: () => void }) {
  const data = trend?.map((v, i) => ({ i, v }))
  const content = (
    <>
      <p className="flex min-w-0 items-center gap-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="truncate">{label}</span>
        {onClick && <ArrowUpRight aria-hidden="true" className="size-3 shrink-0 text-primary" />}
      </p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <span className="min-w-0 truncate text-[clamp(0.8rem,4vw,1rem)] font-bold tracking-tight tabular-nums sm:text-lg" style={{ color: valueColor }}>{value}</span>
        {data && data.length > 1 && (
          // Decorativo: la cifra de al lado ya dice lo mismo en texto, así que
          // se oculta a lectores de pantalla en vez de anunciar un SVG mudo.
          <span aria-hidden="true" className="hidden shrink-0 sm:block">
            <SparkLineChart data={data} index="i" categories={["v"]} colors={[trendColor ?? "blue"]} className="h-5 w-12 shrink-0" />
          </span>
        )}
      </div>
      {detail && <p className={`mt-0.5 truncate text-xs ${detailTone === "positive" ? "text-emerald-500" : detailTone === "negative" ? "text-red-500" : "text-muted-foreground"}`}>{detail}</p>}
      {secondaryDetail && <p className="truncate text-[10px] text-muted-foreground">{secondaryDetail}</p>}
    </>
  )
  if (onClick) {
      return (
      <button type="button" onClick={onClick} aria-label={`Ver detalle de ${label}`} className="min-h-[92px] min-w-0 w-full rounded-2xl border border-border bg-card p-3 text-left transition-all card-glow hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] sm:min-h-0 sm:p-3.5">
        {content}
      </button>
    )
  }
  return <div className="min-h-[92px] min-w-0 rounded-2xl border border-border bg-card p-3 transition-colors card-glow sm:min-h-0 sm:p-3.5">{content}</div>
}
