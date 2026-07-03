"use client"

import { useMemo, useRef, useState } from "react"

// Gráfico de línea limpia: solo el trazo y el punto final, sin relleno ni
// degradados. Sustituye al antiguo tratamiento "montaña" (picos + doble capa
// de relleno + marcador con brillo), que se veía recargado.
export function MountainChart<T extends object>({
  data,
  index,
  category,
  valueFormatter,
  className,
}: {
  data: T[]
  index: keyof T & string
  category: keyof T & string
  valueFormatter: (v: number) => string
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  const VB_W = 600
  const VB_H = 220
  const PAD_TOP = 16
  const PAD_BOTTOM = 8

  const values = data.map((d) => Number(d[category]) || 0)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
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

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || points.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const idx = Math.round(ratio * (points.length - 1))
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)))
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null
  const last = points.at(-1)
  const first = points[0]
  // Sin interacción de teclado (el detalle punto a punto solo se ve al pasar
  // el ratón), así que al menos el resumen inicio→fin se anuncia a lectores
  // de pantalla vía aria-label en vez de dejar el gráfico en silencio total.
  const trendSummary = first && last
    ? `Gráfico de evolución de ${first.label} a ${last.label}: de ${valueFormatter(first.v)} a ${valueFormatter(last.v)}.`
    : "Gráfico de evolución sin datos."

  return (
    <div ref={containerRef} className={`relative select-none ${className ?? ""}`} onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)} role="img" aria-label={trendSummary}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible" aria-hidden="true">
        {/* Líneas de referencia horizontales, discretas */}
        <line x1="0" y1={PAD_TOP} x2={VB_W} y2={PAD_TOP} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={(PAD_TOP + VB_H) / 2} x2={VB_W} y2={(PAD_TOP + VB_H) / 2} stroke="var(--border)" strokeWidth="1" />
        <line x1="0" y1={VB_H - PAD_BOTTOM} x2={VB_W} y2={VB_H - PAD_BOTTOM} stroke="var(--border)" strokeWidth="1" />

        {points.length > 1 && <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}

        {last && <circle cx={last.x} cy={last.y} r="3.5" fill="var(--gold)" />}

        {hovered && (
          <>
            <line x1={hovered.x} y1={PAD_TOP} x2={hovered.x} y2={VB_H - PAD_BOTTOM} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hovered.x} cy={hovered.y} r="3.5" fill="var(--gold)" stroke="var(--hero-bg)" strokeWidth="2" />
          </>
        )}
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-y-full rounded-xl border border-border bg-popover px-3 py-2 text-xs shadow-lg"
          style={{ left: `${(hovered.x / VB_W) * 100}%`, transform: `translate(-50%, -8px)` }}
        >
          <p className="font-semibold text-foreground tabular-nums">{valueFormatter(hovered.v)}</p>
          <p className="text-muted-foreground">{hovered.label}</p>
        </div>
      )}

      <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]?.label}</span>
        {points.length > 2 && <span>{points[Math.floor((points.length - 1) / 2)]?.label}</span>}
        <span>{points.at(-1)?.label}</span>
      </div>
    </div>
  )
}
