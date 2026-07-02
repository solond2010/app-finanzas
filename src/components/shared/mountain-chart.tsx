"use client"

import { useMemo, useRef, useState } from "react"

// Gráfico de área "montaña": picos angulosos (líneas rectas entre puntos,
// no curva suavizada) con dos capas de relleno superpuestas (una tenue
// detrás, desplazada) para dar sensación de profundidad, y un marcador
// dorado en el punto más alto.
// Sustituye al AreaChart de Tremor solo donde se quiere este tratamiento
// premium — el resto de gráficos de la app se quedan con Tremor + su tooltip
// compartido (createChartTooltip).
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
  const PAD_TOP = 24
  const PAD_BOTTOM = 8

  const values = data.map((d) => Number(d[category]) || 0)
  const max = Math.max(...values, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const peakIdx = values.indexOf(max)

  const points = useMemo(
    () =>
      values.map((v, i) => {
        const x = data.length > 1 ? (i / (data.length - 1)) * VB_W : VB_W / 2
        const y = PAD_TOP + (1 - (v - min) / span) * (VB_H - PAD_TOP - PAD_BOTTOM)
        return { x, y, v, label: String(data[i][index]) }
      }),
    [values, data, min, span, index]
  )

  // Picos con punta: segmentos rectos entre puntos consecutivos, sin
  // suavizado. La capa "back" va desplazada hacia arriba para simular una
  // segunda cresta detrás de la principal.
  function sharpPath(pts: { x: number; y: number }[], offsetY = 0) {
    if (pts.length === 0) return ""
    if (pts.length === 1) return `M${pts[0].x},${pts[0].y + offsetY}`
    return pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y + offsetY}`).join(" ")
  }

  const linePath = sharpPath(points)
  const frontArea = `${linePath} L${VB_W},${VB_H} L0,${VB_H} Z`
  const backLinePath = sharpPath(points, -10)
  const backArea = `${backLinePath} L${VB_W},${VB_H} L0,${VB_H} Z`

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || points.length === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const idx = Math.round(ratio * (points.length - 1))
    setHoverIdx(Math.max(0, Math.min(points.length - 1, idx)))
  }

  const hovered = hoverIdx !== null ? points[hoverIdx] : null

  return (
    <div ref={containerRef} className={`relative select-none ${className ?? ""}`} onMouseMove={handleMove} onMouseLeave={() => setHoverIdx(null)}>
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="mountain-back" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3f6bff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#3f6bff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="mountain-front" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e8b64a" stopOpacity="0.45" />
            <stop offset="45%" stopColor="#3f6bff" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#3f6bff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {points.length > 1 && (
          <>
            <path d={backArea} fill="url(#mountain-back)" />
            <path d={frontArea} fill="url(#mountain-front)" />
            <path d={linePath} fill="none" stroke="#8fabff" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {peakIdx >= 0 && points[peakIdx] && (
          <circle cx={points[peakIdx].x} cy={points[peakIdx].y} r="4.5" fill="var(--hero-bg)" stroke="#e8b64a" strokeWidth="2.5" />
        )}

        {hovered && (
          <>
            <line x1={hovered.x} y1={PAD_TOP} x2={hovered.x} y2={VB_H} stroke="var(--hero-border)" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={hovered.x} cy={hovered.y} r="4" fill="#8fabff" stroke="var(--hero-bg)" strokeWidth="2" />
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
