"use client"

import { useId, useMemo, useRef, useState } from "react"
import { getNetWorthChartDomain } from "@/lib/chart-scale"

// Gráfico de línea limpia: el trazo, el punto final y un único velo dorado
// muy tenue bajo la línea (degradado a transparente). Sustituye al antiguo
// tratamiento "montaña" (picos + doble capa de relleno + marcador con
// brillo), que se veía recargado; una sola capa al ~10% no compite con el
// trazo y ancla visualmente la curva a la tarjeta hero.
export function MountainChart<T extends object>({
  data,
  index,
  category,
  valueFormatter,
  className,
  pinnedIndex = null,
  onPin,
}: {
  data: T[]
  index: keyof T & string
  category: keyof T & string
  valueFormatter: (v: number) => string
  className?: string
  /** Punto fijado (controlado). Con `onPin`, clic/toque fija un punto. */
  pinnedIndex?: number | null
  onPin?: (index: number | null) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  // Id único por instancia: en una misma página conviven varios MountainChart
  // (dashboard e inversiones) y un id fijo de <linearGradient> colisionaría.
  const gradientId = useId()

  const VB_W = 600
  const VB_H = 220
  const PAD_TOP = 16
  const PAD_BOTTOM = 8

  const values = data.map((d) => Number(d[category]) || 0)
  // Escala lineal por euros: en rangos casi planos dejamos espacio alrededor
  // del saldo para que una caída de 20 € sea leve y no ocupe media gráfica.
  const { min, max } = getNetWorthChartDomain(values)
  const span = max - min || 1

  const points = useMemo(
    () =>
      values.map((v, i) => {
        const x = data.length > 1 ? (i / (data.length - 1)) * VB_W : VB_W / 2
        const y = PAD_TOP + (1 - (v - min) / span) * (VB_H - PAD_TOP - PAD_BOTTOM)
        return { x, y, v, label: String(data[i][index]) }
      }),
    [values, data, min, span, index]
  )

  const linePath = points.length === 0 ? "" : points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ")
  const areaPath =
    points.length > 1
      ? `${linePath} L${points.at(-1)!.x},${VB_H - PAD_BOTTOM} L${points[0].x},${VB_H - PAD_BOTTOM} Z`
      : ""

  const indexAt = (clientX: number) => {
    if (!containerRef.current || points.length === 0) return null
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = (clientX - rect.left) / rect.width
    return Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))))
  }
  const handlePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const idx = indexAt(e.clientX)
    if (idx !== null) setHoverIdx(idx)
  }
  // Al soltar se fija el punto: en táctil, tras arrastrar el dedo (scrub);
  // con ratón, un clic sobre el mismo punto lo suelta.
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onPin) return
    const idx = indexAt(e.clientX)
    if (idx === null) return
    if (e.pointerType === "touch") {
      setHoverIdx(null)
      onPin(idx)
    } else {
      onPin(idx === pinnedIndex ? null : idx)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!points.length) return
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return
    e.preventDefault()
    setHoverIdx((current) => {
      if (e.key === "Home") return 0
      if (e.key === "End") return points.length - 1
      const start = current ?? (e.key === "ArrowRight" ? -1 : points.length)
      return Math.max(0, Math.min(points.length - 1, start + (e.key === "ArrowRight" ? 1 : -1)))
    })
  }
  const handleKeyAction = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onPin) return
    if ((e.key === "Enter" || e.key === " ") && hoverIdx !== null) { e.preventDefault(); onPin(hoverIdx) }
    else if (e.key === "Escape" && pinnedIndex !== null) { e.preventDefault(); onPin(null) }
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null
  const pinned = pinnedIndex !== null && pinnedIndex >= 0 ? points[pinnedIndex] ?? null : null
  const hoveredPrev = hoverIdx !== null && hoverIdx > 0 ? points[hoverIdx - 1] : null
  const last = points.at(-1)
  const first = points[0]
  // Sin interacción de teclado (el detalle punto a punto solo se ve al pasar
  // el ratón), así que al menos el resumen inicio→fin se anuncia a lectores
  // de pantalla vía aria-label en vez de dejar el gráfico en silencio total.
  const trendSummary = first && last
    ? `Gráfico de evolución de ${first.label} a ${last.label}: de ${valueFormatter(first.v)} a ${valueFormatter(last.v)}.`
    : "Gráfico de evolución sin datos."

  return (
    <div
      ref={containerRef}
      className={`relative flex select-none flex-col outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary ${className ?? ""}`}
      onPointerMove={handlePointer}
      onPointerDown={(e) => { if (e.pointerType === "touch") handlePointer(e) }}
      onPointerUp={handlePointerUp}
      onPointerCancel={(e) => { if (e.pointerType === "touch") setHoverIdx(null) }}
      onPointerLeave={(e) => { if (e.pointerType !== "touch") setHoverIdx(null) }}
      onKeyDown={(e) => { handleKeyDown(e); handleKeyAction(e) }}
      role="group"
      aria-roledescription="gráfico interactivo"
      aria-label={`${trendSummary} Usa las flechas para recorrer los puntos${onPin ? " e Intro para fijar uno" : ""}.`}
      tabIndex={points.length ? 0 : -1}
      style={{ touchAction: "pan-y", cursor: onPin ? "pointer" : undefined }}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="min-h-0 w-full flex-1 overflow-visible" aria-hidden="true">
        <defs>
<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
             <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.22" />
             <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
           </linearGradient>
        </defs>
        {/* Líneas de referencia horizontales, discretas */}
        <line x1="0" y1={PAD_TOP} x2={VB_W} y2={PAD_TOP} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={(PAD_TOP + VB_H) / 2} x2={VB_W} y2={(PAD_TOP + VB_H) / 2} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={VB_H - PAD_BOTTOM} x2={VB_W} y2={VB_H - PAD_BOTTOM} stroke="var(--border)" strokeWidth="1" />

        {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}

{points.length > 1 && <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.15))" />}

         {last && <circle cx={last.x} cy={last.y} r="4" fill="var(--gold)" stroke="var(--hero-bg)" strokeWidth="1.5" />}

{pinned && (
           <>
             <line x1={pinned.x} y1={PAD_TOP} x2={pinned.x} y2={VB_H - PAD_BOTTOM} stroke="var(--primary)" strokeOpacity="0.55" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
             <circle cx={pinned.x} cy={pinned.y} r="6" fill="var(--primary)" stroke="var(--hero-bg)" strokeWidth="2" />
           </>
         )}

{hovered && (
           <>
             <line x1={hovered.x} y1={PAD_TOP} x2={hovered.x} y2={VB_H - PAD_BOTTOM} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
             <circle cx={hovered.x} cy={hovered.y} r="4" fill="var(--gold)" stroke="var(--hero-bg)" strokeWidth="2" />
           </>
         )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-y-full rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: `${Math.max(6, Math.min(94, (hovered.x / VB_W) * 100))}%`, transform: `translate(-50%, -8px)` }}
        >
          <p className="font-semibold text-foreground tabular-nums">{valueFormatter(hovered.v)}</p>
          {hoveredPrev && (
            <p className={`tabular-nums ${hovered.v - hoveredPrev.v >= 0 ? "text-emerald-500" : "text-red-500"}`}>
              {hovered.v - hoveredPrev.v >= 0 ? "+" : "−"}{valueFormatter(Math.abs(hovered.v - hoveredPrev.v))} vs. {hoveredPrev.label}
            </p>
          )}
          <p className="text-muted-foreground">{hovered.label}</p>
        </div>
      )}

      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {hovered ? `${hovered.label}: ${valueFormatter(hovered.v)}` : ""}
      </span>

      <div className={`mt-2 grid shrink-0 ${points.length > 2 ? "grid-cols-3" : "grid-cols-2"} items-center text-[10px] leading-4 text-muted-foreground sm:text-[11px]`}>
        <span className="min-w-0 truncate text-left">{points[0]?.label}</span>
        {points.length > 2 && <span className="min-w-0 truncate px-1 text-center">{points[Math.floor((points.length - 1) / 2)]?.label}</span>}
        <span className="min-w-0 truncate text-right">{points.at(-1)?.label}</span>
      </div>
    </div>
  )
}
