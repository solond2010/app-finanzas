import type { ReactNode } from "react"
import { SparkLineChart } from "@tremor/react"
import { ChevronRight, type AppIcon } from "@/components/icons"

// Tarjeta compacta estilo "ticker" con un mini-gráfico de tendencia opcional
// (si no hay serie histórica disponible, como en la rentabilidad de cartera,
// se omite y solo se ve la cifra).
//
// `value` debe ser siempre la cifra (corta, protagonista); un nombre largo
// asociado (cuenta, categoría, posición) va en `detail`, que se pinta en una
// segunda línea truncable. Antes iban juntos en una línea ("Nombre · 20%") y
// en pantallas estrechas el nombre truncado dejaba restos como "Co… · 20%".
// `icon` (opcional): icono dúo en una pastilla suave del color de la cifra
// (`iconColor`, por defecto el de `valueColor`), igual que las tarjetas
// «Acumulado». Si la tarjeta se puede tocar, la flechita › solo aparece al
// pasar el ratón o con el foco del teclado (en móvil no hace falta).
export function TickerTile({ label, value, detail, detailTone, secondaryDetail, valueColor, trend, trendColor, onClick, icon: Icon, iconColor }: { label: string; value: ReactNode; detail?: ReactNode; detailTone?: "positive" | "negative" | "neutral"; secondaryDetail?: ReactNode; valueColor?: string; trend?: number[]; trendColor?: string; onClick?: () => void; icon?: AppIcon; iconColor?: string }) {
  const chipColor = iconColor ?? valueColor ?? "var(--muted-foreground)"
  const data = trend?.map((v, i) => ({ i, v }))
  const content = (
    <>
      <p className="flex min-w-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && (
          <span aria-hidden="true" className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px]" style={{ backgroundColor: `color-mix(in oklab, ${chipColor} 15%, transparent)`, color: chipColor }}>
            <Icon className="app-icon-tint size-3.5" style={{ color: chipColor }} />
          </span>
        )}
        <span className="min-w-0 truncate">{label}</span>
        {onClick && <ChevronRight aria-hidden="true" className="ml-auto hidden size-3 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 sm:block" />}
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
      {detail && <p className={`mt-0.5 line-clamp-2 min-h-8 break-words text-xs leading-4 ${detailTone === "positive" ? "text-emerald-500" : detailTone === "negative" ? "text-red-500" : "text-muted-foreground"}`}>{detail}</p>}
      {secondaryDetail && <p className="line-clamp-2 break-words text-[10px] leading-4 text-muted-foreground">{secondaryDetail}</p>}
    </>
  )
  if (onClick) {
      return (
      <button type="button" onClick={onClick} aria-label={`Ver detalle de ${label}`} className="group min-h-[92px] min-w-0 w-full rounded-2xl border border-border bg-card p-3 text-left transition-all card-glow hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] sm:min-h-0 sm:p-3.5">
        {content}
      </button>
    )
  }
  return <div className="min-h-[92px] min-w-0 rounded-2xl border border-border bg-card p-3 transition-colors card-glow sm:min-h-0 sm:p-3.5">{content}</div>
}
