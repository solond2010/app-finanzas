import { readFileSync } from "node:fs"
import { resolve } from "node:path"
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
    const days = Array.from({ length: 30 }, (_, i) => p(`2026-10-${String(i + 1).padStart(2, "0")}`, 100 + i))
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

  it("no dibuja el tramo a 0 anterior al primer dato", () => {
    const pts = [
      { date: "2026-01-31", value: 0, label: "ene" },
      { date: "2026-02-28", value: 0, label: "feb" },
      { date: "2026-03-01", value: 1000, label: "1 mar" },
      { date: "2026-04-30", value: 1500, label: "abr" },
      { date: "2026-05-31", value: 1800, label: "may" },
    ]
    const r = chartSeries(pts, "2026-06-01")
    expect(r.points[0].value).toBe(1000)
  })
})

describe("la tarjeta de Inicio rellena el hueco del grid", () => {
  const src = readFileSync(resolve(__dirname, "../app/(main)/dashboard/dashboard-content.tsx"), "utf8")
  const chart = src.match(/<NetWorthChart[\s\S]*?className="([^"]+)"/)

  it("el gráfico usa flex-1 y min-h, sin height fija que deje un hueco", () => {
    expect(chart, "tiene que haber un NetWorthChart en el Inicio").toBeTruthy()
    const cls = chart![1]
    expect(cls).toMatch(/flex-1/)
    expect(cls).toMatch(/min-h-40/)
    expect(cls).not.toMatch(/(?<![\w-])h-40\b/)
    expect(cls).not.toMatch(/sm:h-52/)
    expect(cls).not.toMatch(/2xl:h-60/)
  })

  it("debajo del gráfico vuelve el resumen de inicio, mínimo, máximo y periodo", () => {
    expect(src).toMatch(/label: "Inicio"/)
    expect(src).toMatch(/label: "Mínimo"/)
    expect(src).toMatch(/label: "Máximo"/)
    expect(src).toMatch(/label: "En el periodo"/)
  })
})
