import { describe, expect, it } from "vitest"
import { axisTicks, chartSeries, monotonePath, monthlyChangeBars, monthlyCloses, normalizeDateKey } from "./net-worth-chart"

const p = (date: string, value: number) => ({ date, value, label: date })

describe("gráfico de patrimonio", () => {
  it("convierte cierres «YYYY-MM» en el último día del mes (o hoy)", () => {
    expect(normalizeDateKey("2026-09", "2026-11-01")).toBe("2026-09-30")
    expect(normalizeDateKey("2026-11", "2026-11-01")).toBe("2026-11-01")
    expect(normalizeDateKey("2026-10-05", "2026-11-01")).toBe("2026-10-05")
  })

  it("en rangos largos pinta un punto por mes (sin picos intercalados)", () => {
    const series = chartSeries([p("2026-06", 100), p("2026-07-12", 180), p("2026-07", 120), p("2026-08", 140), p("2026-11-01", 150)], "2026-11-01")
    expect(series.monthly).toBe(true)
    expect(series.points.map((x) => x.value)).toEqual([100, 120, 140, 150])
  })

  it("en 7D/30D conserva los puntos diarios", () => {
    const days = Array.from({ length: 30 }, (_, i) => p(`2026-10-${String(i + 1).padStart(2, "0")}`, i))
    const series = chartSeries(days, "2026-10-30")
    expect(series.monthly).toBe(false)
    expect(series.points).toHaveLength(30)
  })

  it("la curva no se pasa de los puntos en un tramo plano", () => {
    const d = monotonePath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 0 }, { x: 30, y: 10 }])
    const ys = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[2]))
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...ys)).toBeLessThanOrEqual(10)
  })

  it("barras de cambio mensual: el mes en curso solo desde el día 10", () => {
    const closes = monthlyCloses([p("2026-09-30", 100), p("2026-10-31", 130), p("2026-11-03", 90)])
    expect(monthlyChangeBars(closes, new Date(2026, 10, 3)).map((b) => b.delta)).toEqual([30])
    expect(monthlyChangeBars(closes, new Date(2026, 10, 12)).map((b) => b.delta)).toEqual([30, -40])
  })

  it("una etiqueta por mes en el eje", () => {
    const ticks = axisTicks([p("2026-05-31", 1), p("2026-08-31", 2), p("2026-11-01", 3)])
    expect(ticks.map((t) => t.label)).toEqual(["jun", "jul", "ago", "sep", "oct", "nov"])
  })
})
