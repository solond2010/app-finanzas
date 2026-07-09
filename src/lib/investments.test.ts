import { describe, it, expect } from "vitest"
import { mergedPosition, dcaStreak, type Position, type Contribution } from "./investments"

function position(overrides: Partial<Position> = {}): Position {
  return {
    id: "pos_1",
    kind: "fund",
    symbol: "IE00BYX5NX33.SG",
    name: "Fidelity MSCI World Index Fund",
    date: "2026-04-17",
    units: 10.269,
    buyPrice: 13.63,
    currency: "EUR",
    accountId: "acc_1",
    ...overrides,
  }
}

describe("mergedPosition", () => {
  it("suma unidades y recalcula el precio medio ponderado", () => {
    const existing = position()
    const incoming = { ...position({ units: 0.706, buyPrice: 13.976 }), id: undefined } as unknown as Omit<Position, "id">
    const merged = mergedPosition(existing, incoming)

    expect(merged.units).toBeCloseTo(10.975, 3)
    expect(merged.buyPrice).toBeCloseTo(13.652, 2)
    expect(merged.id).toBe(existing.id)
  })

  it("se queda con la fecha más reciente de las dos compras", () => {
    const existing = position({ date: "2026-04-17" })
    const incoming = position({ date: "2026-06-24" })
    expect(mergedPosition(existing, incoming).date).toBe("2026-06-24")

    const olderIncoming = position({ date: "2026-01-01" })
    expect(mergedPosition(existing, olderIncoming).date).toBe("2026-04-17")
  })

  it("no pisa un plan DCA existente si la compra nueva no trae uno", () => {
    const existing = position({ dca: true, dcaAmount: 50, dcaFreq: "monthly", dcaLast: "2026-06-01" })
    const incoming = position({ dca: false })
    const merged = mergedPosition(existing, incoming)

    expect(merged.dca).toBe(true)
    expect(merged.dcaAmount).toBe(50)
  })
})

function contribution(overrides: Partial<Contribution> = {}): Contribution {
  return { id: "c_1", positionId: "pos_1", amount: 100, date: "2026-06-01", ...overrides }
}

describe("dcaStreak", () => {
  const today = new Date("2026-06-15")

  it("cuenta los meses consecutivos hasta el mes actual (incluido)", () => {
    const contributions = [
      contribution({ id: "a", date: "2026-04-10" }),
      contribution({ id: "b", date: "2026-05-05" }),
      contribution({ id: "c", date: "2026-06-01" }),
    ]
    expect(dcaStreak(contributions, "pos_1", "monthly", today)).toBe(3)
  })

  it("si el mes actual todavía no tiene aporte, cuenta desde el mes anterior", () => {
    const contributions = [
      contribution({ id: "a", date: "2026-04-10" }),
      contribution({ id: "b", date: "2026-05-05" }),
    ]
    expect(dcaStreak(contributions, "pos_1", "monthly", today)).toBe(2)
  })

  it("corta en el primer hueco", () => {
    const contributions = [
      contribution({ id: "a", date: "2026-04-10" }), // hueco en mayo
      contribution({ id: "b", date: "2026-06-01" }),
    ]
    expect(dcaStreak(contributions, "pos_1", "monthly", today)).toBe(1)
  })

  it("devuelve 0 sin aportes para esa posición", () => {
    expect(dcaStreak([], "pos_1", "monthly", today)).toBe(0)
    expect(dcaStreak([contribution({ positionId: "otra" })], "pos_1", "monthly", today)).toBe(0)
  })
})
