// Utilidades puras del gráfico «Evolución del patrimonio» (sin React).
//  - Curva monótona (Fritsch–Carlson): suave, pero nunca se pasa de los
//    puntos reales (no inventa picos ni valles entre dos meses).
//  - Cierres de mes: en rangos largos se pinta un punto por mes (el último
//    valor de cada mes) en vez de picos diarios intercalados, que eran los
//    que dibujaban el zigzag «a pinchos».
//  - Etiquetas del eje: una por mes («jun», «jul»…) o por día en 7D/30D.

export type SeriesPoint = { date: string; value: number; label: string }
export type XY = { x: number; y: number }

const DAY = 86_400_000
export const MONTHS_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

export function dateKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** «YYYY-MM» (cierre mensual) → último día de ese mes, o hoy si es el mes en curso. */
export function normalizeDateKey(date: string, todayKey: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10)
  if (/^\d{4}-\d{2}$/.test(date)) {
    const [y, m] = date.split("-").map(Number)
    const end = dateKeyOf(new Date(y, m, 0))
    return end > todayKey ? todayKey : end
  }
  return date
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.slice(0, 10).split("-").map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Días entre el primer y el último punto (0 si no se puede saber). */
export function spanDays(points: SeriesPoint[]): number {
  if (points.length < 2) return 0
  return Math.round((parseKey(points.at(-1)!.date).getTime() - parseKey(points[0].date).getTime()) / DAY)
}

/** ¿Fechas válidas y estrictamente crecientes? (si no, escala por posición). */
export function hasTimeScale(points: SeriesPoint[]): boolean {
  if (points.length < 2) return false
  for (let i = 0; i < points.length; i++) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(points[i].date)) return false
    if (i > 0 && points[i].date <= points[i - 1].date) return false
  }
  return true
}

/** Último punto de cada mes, en orden. */
export function monthlyCloses(points: SeriesPoint[]): SeriesPoint[] {
  const byMonth = new Map<string, SeriesPoint>()
  for (const p of points) byMonth.set(p.date.slice(0, 7), p)
  return [...byMonth.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/**
 * Serie que se pinta. Rangos de más de 45 días: un punto por mes. Rangos
 * cortos (7D/30D): todos los puntos diarios.
 */
export function chartSeries(points: SeriesPoint[], todayKey: string): { points: SeriesPoint[]; monthly: boolean } {
  const normalized = points.map((p) => ({ ...p, date: normalizeDateKey(p.date, todayKey) }))
  if (!hasTimeScale(dedupeSameDay(normalized))) return { points: normalized, monthly: false }
  // Antes del primer dato real el patrimonio sale a 0: no se dibuja ese tramo.
  const deduped = dedupeSameDay(normalized)
  const firstReal = deduped.findIndex((p) => Math.abs(p.value) >= 0.5)
  const clean = firstReal > 0 ? deduped.slice(firstReal) : deduped
  if (clean.length < 2) return { points: deduped.slice(-2), monthly: false }
  if (spanDays(clean) <= 45) return { points: clean, monthly: false }
  return { points: monthlyCloses(clean), monthly: true }
}

/** Si dos puntos caen el mismo día, se queda el último (p. ej. pico + hoy). */
function dedupeSameDay(points: SeriesPoint[]): SeriesPoint[] {
  const out: SeriesPoint[] = []
  for (const p of points) {
    if (out.length && out.at(-1)!.date === p.date) out[out.length - 1] = p
    else out.push(p)
  }
  return out
}

/** Trazado SVG de una curva monótona que pasa por todos los puntos. */
export function monotonePath(pts: XY[]): string {
  const n = pts.length
  if (n === 0) return ""
  if (n === 1) return `M${pts[0].x},${pts[0].y}`
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x || 1e-6
    m[i] = (pts[i + 1].y - pts[i].y) / dx[i]
  }
  const t: number[] = [m[0]]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  t[n - 1] = m[n - 2]
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const h = a * a + b * b
    if (h > 9) {
      const k = 3 / Math.sqrt(h)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  const r = (v: number) => Math.round(v * 100) / 100
  let d = `M${r(pts[0].x)},${r(pts[0].y)}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += ` C${r(pts[i].x + h)},${r(pts[i].y + t[i] * h)} ${r(pts[i + 1].x - h)},${r(pts[i + 1].y - t[i + 1] * h)} ${r(pts[i + 1].x)},${r(pts[i + 1].y)}`
  }
  return d
}

export type MonthBar = { month: string; mid: string; delta: number }

/**
 * Cambio de patrimonio de cada mes a partir de los cierres mensuales. El mes
 * en curso solo aparece a partir del día 10 (antes sería una barra engañosa).
 */
export function monthlyChangeBars(closes: SeriesPoint[], today: Date): MonthBar[] {
  const currentMonth = dateKeyOf(today).slice(0, 7)
  const bars: MonthBar[] = []
  for (let i = 1; i < closes.length; i++) {
    const month = closes[i].date.slice(0, 7)
    if (month === currentMonth && today.getDate() < 10) continue
    const mid = `${month}-15`
    bars.push({ month, mid: mid > closes[i].date ? closes[i].date : mid, delta: closes[i].value - closes[i - 1].value })
  }
  return bars
}

export type AxisTick = { key: string; label: string }

/** Marcas del eje X: día 1 de cada mes (rangos largos) o ~5 días repartidos. */
export function axisTicks(points: SeriesPoint[]): AxisTick[] {
  if (points.length < 2 || !hasTimeScale(points)) return []
  const first = parseKey(points[0].date)
  const last = parseKey(points.at(-1)!.date)
  if (spanDays(points) > 45) {
    const ticks: AxisTick[] = []
    for (let d = new Date(first.getFullYear(), first.getMonth() + (first.getDate() > 1 ? 1 : 0), 1); d <= last; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      const label = d.getMonth() === 0 ? `${MONTHS_SHORT[0]} ${String(d.getFullYear()).slice(2)}` : MONTHS_SHORT[d.getMonth()]
      ticks.push({ key: dateKeyOf(d), label })
    }
    return ticks
  }
  const count = Math.min(5, points.length)
  const ticks: AxisTick[] = []
  for (let i = 0; i < count; i++) {
    const p = points[Math.round((i * (points.length - 1)) / Math.max(1, count - 1))]
    const d = parseKey(p.date)
    if (!ticks.some((t) => t.key === p.date)) ticks.push({ key: p.date, label: `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` })
  }
  return ticks
}

/** «31 ago 2026». */
export function longDate(key: string): string {
  const d = parseKey(key)
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}
