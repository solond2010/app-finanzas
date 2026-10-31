import { describe, expect, it } from "vitest"
import { limitWorsened, monthlyLimitStatus } from "./monthly-limit"
import type { Transaction } from "./store"

const tx = (id: string, monto: number, fecha: string, extra: Partial<Transaction> = {}) =>
  ({ id, cuenta_id: "a", tipo: "gasto", monto, fecha, categoria: "Comida", descripcion: "", ...extra }) as Transaction

describe("monthly limit", () => {
  const now = new Date(2026, 9, 31)
  it("is null without a limit", () => {
    expect(monthlyLimitStatus({ id: "a", limite_mensual: null }, [], now)).toBeNull()
  })
  it("counts only this month's expenses of that account", () => {
    const s = monthlyLimitStatus({ id: "a", limite_mensual: 100 }, [
      tx("1", 50, "2026-10-02"),
      tx("2", 40, "2026-10-20"),
      tx("3", 500, "2026-09-30"),
      tx("4", 500, "2026-10-05", { cuenta_id: "b" }),
      tx("5", 500, "2026-10-05", { tipo: "ingreso" }),
    ], now)!
    expect(s.spent).toBe(90)
    expect(s.level).toBe("near")
    expect(s.remaining).toBe(10)
  })
  it("reports how much you went over", () => {
    const s = monthlyLimitStatus({ id: "a", limite_mensual: 100 }, [tx("1", 130, "2026-10-02")], now)!
    expect(s.level).toBe("over")
    expect(s.over).toBe(30)
    expect(Math.round(s.pct)).toBe(130)
  })
  it("detects worsening only after a known level", () => {
    expect(limitWorsened(undefined, "over")).toBe(false)
    expect(limitWorsened("ok", "near")).toBe(true)
    expect(limitWorsened("near", "over")).toBe(true)
    expect(limitWorsened("over", "near")).toBe(false)
  })
})
