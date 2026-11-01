"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { getNetWorthChartDomain } from "@/lib/chart-scale"
import { axisTicks, hasTimeScale, longDate, monotonePath, parseKey, type MonthBar, type SeriesPoint } from "@/lib/net-worth-chart"
import { cn } from "@/lib/utils"

// «Evolución del patrimonio»: curva suave (monótona) con degradado naranja,
// rejilla mínima, punto final con brillo y cruceta con fecha y valor.
//  - size="card": la tarjeta de Inicio. Clic/toque abre la vista ampliada.
//  - size="large": la vista ampliada, con marcas de Mín/Máx y, si hay,
//    barras verdes/rojas con el cambio de cada mes.
// Todo en píxeles reales (se mide el contenedor): los círculos no se
// deforman y el texto del eje tiene siempre el mismo tamaño.

const GOLD = "var(--gold)"
const compactEuro = (v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString("es-ES", { maximumFractionDigits: Math.abs(v) >= 100000 ? 0 : 1 })}k` : `${Math.round(v)}`
const GREEN = "#2BD9A0"
const RED = "#FF6B5B"

export function NetWorthChart({
  points,
  size = "card",
  monthly = false,
  formatValue,
  formatAxis,
  hideValues = false,
  bars,
  onActivate,
  activateLabel,
  className,
}: {
  points: SeriesPoint[]
  size?: "card" | "large"
  /** Serie de cierres mensuales (puntitos en cada mes). */
  monthly?: boolean
  formatValue: (v: number) => string
  formatAxis?: (v: number) => string
  /** Modo privacidad: sin importes en tooltip ni marcas. */
  hideValues?: boolean
  bars?: MonthBar[]
  /** Con esto, clic/toque (sin arrastrar) o Intro abre la vista ampliada. */
  onActivate?: () => void
  activateLabel?: string
  className?: string
}) {
  const large = size === "large"
  const ref = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [hover, setHover] = useState<number | null>(null)
  const down = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  const uid = useId().replace(/:/g, "")

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const showBars = large && !!bars && bars.length > 0
  const PAD_TOP = large ? 30 : 12
  const AXIS_H = 22
  const BARS_H = showBars ? (box.w < 520 ? 46 : 62) : 0
  const PAD_L = large ? 44 : 2
  const PAD_R = large ? 16 : 10

  const geo = useMemo(() => {
    const { w, h } = box
    if (!w || !h || points.length === 0) return null
    const plotBottom = h - AXIS_H - BARS_H
    const values = points.map((p) => p.value)
    const { min, max } = getNetWorthChartDomain(values)
    const span = max - min || 1
    const timeScale = hasTimeScale(points)
    const t0 = timeScale ? parseKey(points[0].date).getTime() : 0
    const t1 = timeScale ? parseKey(points.at(-1)!.date).getTime() : 1
    const innerW = Math.max(1, w - PAD_L - PAD_R)
    const xOfKey = (key: string) => PAD_L + ((parseKey(key).getTime() - t0) / (t1 - t0 || 1)) * innerW
    const xOf = (i: number) => (timeScale ? xOfKey(points[i].date) : PAD_L + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2))
    const yOf = (v: number) => PAD_TOP + (1 - (v - min) / span) * (plotBottom - PAD_TOP)
    const xy = points.map((p, i) => ({ x: xOf(i), y: yOf(p.value) }))
    const line = monotonePath(xy)
    const area = xy.length > 1 ? `${line} L${xy.at(-1)!.x},${plotBottom} L${xy[0].x},${plotBottom} Z` : ""
    const grid = [0.2, 0.5, 0.8].map((f) => min + span * f)
    const ticks = timeScale ? axisTicks(points).map((t) => ({ ...t, x: xOfKey(t.key) })) : []
    return { w, h, plotBottom, xy, line, area, grid, yOf, xOfKey, ticks, timeScale }
  }, [box, points, PAD_TOP, BARS_H, PAD_L, PAD_R])

  const nearest = (clientX: number) => {
    if (!geo || !ref.current) return null
    const x = clientX - ref.current.getBoundingClientRect().left
    let best = 0
    for (let i = 1; i < geo.xy.length; i++) if (Math.abs(geo.xy[i].x - x) < Math.abs(geo.xy[best].x - x)) best = i
    return best
  }

  const first = points[0]
  const last = points.at(-1)
  const hovered = hover !== null && geo ? { p: points[hover], xy: geo.xy[hover] } : null
  const iMax = points.reduce((b, p, i) => (p.value > points[b].value ? i : b), 0)
  const iMin = points.reduce((b, p, i) => (p.value < points[b].value ? i : b), 0)
  const summary = first && last ? `Patrimonio de ${first.label} a ${last.label}: de ${formatValue(first.value)} a ${formatValue(last.value)}.` : "Sin datos."

  // Etiquetas del eje sin solaparse y con «hoy» al final.
  const ticks = useMemo(() => {
    if (!geo) return []
    const minGap = 34
    const out: { key: string; label: string; x: number; strong?: boolean }[] = []
    for (const t of geo.ticks) {
      if (t.x < PAD_L - 1 || t.x > geo.w - PAD_R - 24) continue
      if (out.length && t.x - out.at(-1)!.x < minGap) continue
      out.push(t)
    }
    if (last && geo.timeScale) {
      const lastX = geo.xy.at(-1)!.x
      while (out.length && lastX - out.at(-1)!.x < minGap) out.pop()
      out.push({ key: "end", label: last.label === "hoy" ? "hoy" : longDate(last.date).replace(/ \d{4}$/, ""), x: lastX, strong: last.label === "hoy" })
    }
    return out
  }, [geo, last, PAD_L, PAD_R])

  const barGeo = useMemo(() => {
    if (!geo || !showBars || !bars) return null
    const zero = geo.h - AXIS_H - BARS_H / 2 + 2
    const maxAbs = Math.max(...bars.map((b) => Math.abs(b.delta)), 1)
    const monthW = bars.length > 1 ? Math.abs(geo.xOfKey(bars[1].mid) - geo.xOfKey(bars[0].mid)) : 60
    const bw = Math.max(6, Math.min(24, monthW * 0.42))
    const hMax = BARS_H / 2 - 8
    return { zero, bw, items: bars.map((b) => ({ ...b, x: Math.min(geo.xOfKey(b.mid), geo.w - PAD_R - bw / 2), hh: (Math.abs(b.delta) / maxAbs) * hMax })) }
  }, [geo, showBars, bars, BARS_H, PAD_R])

  const tipLeft = hovered && geo ? Math.max(4, Math.min(geo.w - 170, hovered.xy.x - 82)) : 0
  const tipTop = hovered ? Math.max(0, hovered.xy.y - 86) : 0
  const change = hovered && first ? hovered.p.value - first.value : 0

  return (
    <div
      ref={ref}
      className={cn("relative select-none outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-primary", onActivate && "cursor-zoom-in", className)}
      style={{ touchAction: "pan-y" }}
      role={onActivate ? "button" : "group"}
      aria-label={`${summary}${onActivate ? ` ${activateLabel ?? "Pulsa para ampliar."}` : " Usa las flechas para recorrer los puntos."}`}
      tabIndex={0}
      onPointerDown={(e) => {
        down.current = { x: e.clientX, y: e.clientY, moved: false }
        if (e.pointerType !== "mouse") setHover(nearest(e.clientX))
      }}
      onPointerMove={(e) => {
        if (down.current && Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) > 8) down.current.moved = true
        if (e.pointerType === "mouse" || down.current) setHover(nearest(e.clientX))
      }}
      onPointerUp={(e) => {
        const d = down.current
        down.current = null
        dragged.current = !!d?.moved
        if (e.pointerType !== "mouse" && onActivate) setHover(null)
      }}
      onClick={() => {
        // El clic (ratón o toque) amplía, salvo si se ha arrastrado para explorar.
        if (!onActivate) return
        if (dragged.current) { dragged.current = false; return }
        setHover(null)
        onActivate()
      }}
      onPointerCancel={() => { down.current = null; setHover(null) }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setHover(null) }}
      onKeyDown={(e) => {
        if (onActivate && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onActivate(); return }
        if (e.key === "Escape") { setHover(null); return }
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
        e.preventDefault()
        setHover((h) => {
          const start = h ?? (e.key === "ArrowRight" ? -1 : points.length)
          return Math.max(0, Math.min(points.length - 1, start + (e.key === "ArrowRight" ? 1 : -1)))
        })
      }}
      onBlur={() => setHover(null)}
    >
      {geo && (
        <svg width={geo.w} height={geo.h} className="block overflow-visible" aria-hidden="true">
          <defs>
            <linearGradient id={`nwa${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={large ? 0.3 : 0.26} />
              <stop offset="60%" stopColor={GOLD} stopOpacity="0.07" />
              <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`nwl${uid}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={GOLD} stopOpacity="0.6" />
              <stop offset="100%" stopColor={GOLD} />
            </linearGradient>
            <filter id={`nwg${uid}`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" /></filter>
          </defs>

          {geo.grid.map((v) => (
            <g key={v}>
              <line x1={PAD_L} x2={geo.w - PAD_R} y1={geo.yOf(v)} y2={geo.yOf(v)} stroke="currentColor" className="text-foreground/[0.07]" strokeDasharray="2 5" />
              {large && !hideValues && <text x={0} y={geo.yOf(v) + 4} className="fill-muted-foreground text-[11px] tabular-nums">{compactEuro(v)}</text>}
            </g>
          ))}

          {geo.area && <path d={geo.area} fill={`url(#nwa${uid})`} />}
          {geo.xy.length > 1 && <path d={geo.line} fill="none" stroke={`url(#nwl${uid})`} strokeWidth={large ? 3 : 2.6} strokeLinecap="round" strokeLinejoin="round" />}

          {monthly && geo.xy.length <= 40 && geo.xy.slice(0, -1).map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={large ? 3.4 : 2.7} className="fill-[var(--hero-bg,#0B0F14)]" stroke={GOLD} strokeOpacity="0.75" strokeWidth="1.6" />
          ))}

          {ticks.map((t) => (
            <g key={t.key}>
              {t.key !== "end" && <line x1={t.x} x2={t.x} y1={geo.plotBottom} y2={geo.plotBottom + 4} stroke="currentColor" className="text-foreground/15" />}
              <text x={t.x} y={geo.h - 6} textAnchor={t.key === "end" ? "end" : t.x < PAD_L + 10 ? "start" : "middle"} className={cn("text-[11px]", t.strong ? "fill-foreground font-semibold" : "fill-muted-foreground")}>{t.label}</text>
            </g>
          ))}

          {barGeo && (
            <g>
              <line x1={PAD_L} x2={geo.w - PAD_R} y1={barGeo.zero} y2={barGeo.zero} stroke="currentColor" className="text-foreground/10" />
              {barGeo.items.map((b) => {
                const up = b.delta >= 0
                return (
                  <g key={b.month}>
                    <rect x={b.x - barGeo.bw / 2} y={up ? barGeo.zero - b.hh : barGeo.zero} width={barGeo.bw} height={Math.max(2, b.hh)} rx="3" fill={up ? GREEN : RED} opacity="0.85" />
                    {geo.w >= 520 && !hideValues && (
                      <text x={b.x} y={up ? barGeo.zero - b.hh - 4 : barGeo.zero + b.hh + 11} textAnchor="middle" className="text-[10px] font-semibold tabular-nums" fill={up ? GREEN : RED}>
                        {up ? "+" : "−"}{(formatAxis ?? formatValue)(Math.abs(b.delta))}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )}

          {large && points.length > 2 && !hideValues && [
            { i: iMax, label: `Máx ${(formatAxis ?? formatValue)(points[iMax].value)}`, color: GREEN, above: true },
            { i: iMin, label: `Mín ${(formatAxis ?? formatValue)(points[iMin].value)}`, color: RED, above: false },
          ].filter((m, k, arr) => k === 0 || m.i !== arr[0].i).map((m) => {
            const p = geo.xy[m.i]
            const wPill = m.label.length * 6.2 + 16
            const cx = Math.max(PAD_L + wPill / 2, Math.min(geo.w - PAD_R - wPill / 2, p.x))
            const cy = m.above ? p.y - 17 : p.y + 19
            return (
              <g key={m.label}>
                <circle cx={p.x} cy={p.y} r="4.5" className="fill-[var(--hero-bg,#0B0F14)]" stroke={m.color} strokeWidth="2" />
                <rect x={cx - wPill / 2} y={cy - 10} width={wPill} height="19" rx="9.5" className="fill-popover" stroke={m.color} strokeOpacity="0.45" />
                <text x={cx} y={cy + 3.5} textAnchor="middle" className="text-[10.5px] font-semibold tabular-nums" fill={m.color}>{m.label}</text>
              </g>
            )
          })}

          {geo.xy.length > 0 && (() => {
            const e = geo.xy.at(-1)!
            return (
              <g>
                <circle cx={e.x} cy={e.y} r={large ? 10 : 8} fill={GOLD} opacity="0.5" filter={`url(#nwg${uid})`} />
                <circle cx={e.x} cy={e.y} r={large ? 5 : 4.5} fill={GOLD} className="stroke-[var(--hero-bg,#0B0F14)]" strokeWidth="2" />
              </g>
            )
          })()}

          {hovered && (
            <g>
              <line x1={hovered.xy.x} x2={hovered.xy.x} y1={PAD_TOP - 6} y2={geo.plotBottom} stroke={GOLD} strokeOpacity="0.55" strokeDasharray="3 4" />
              <circle cx={hovered.xy.x} cy={hovered.xy.y} r="6" className="fill-[var(--hero-bg,#0B0F14)]" stroke={GOLD} strokeWidth="2.5" />
            </g>
          )}
        </svg>
      )}

      {hovered && geo && (
        <div className="pointer-events-none absolute z-10 min-w-[150px] rounded-xl border border-primary/35 bg-popover/95 px-3 py-2 shadow-xl shadow-black/30 backdrop-blur-sm" style={{ left: tipLeft, top: tipTop }}>
          <p className="text-[11px] text-muted-foreground">{hovered.p.label === "hoy" ? `Hoy · ${longDate(hovered.p.date)}` : geo.timeScale ? longDate(hovered.p.date) : hovered.p.label}</p>
          <p className="font-heading text-base font-bold tabular-nums text-foreground">{hideValues ? "••••" : formatValue(hovered.p.value)}</p>
          {hover !== 0 && first && !hideValues && (
            <p className={cn("text-[11px] font-medium tabular-nums", change >= 0 ? "text-emerald-500" : "text-red-500")}>
              {change >= 0 ? "+" : "−"}{formatValue(Math.abs(change))} desde {geo.timeScale ? `el ${longDate(first.date).replace(/ \d{4}$/, "")}` : "el inicio"}
            </p>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">{hovered && !hideValues ? `${hovered.p.label}: ${formatValue(hovered.p.value)}` : ""}</span>
    </div>
  )
}
