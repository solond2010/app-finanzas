import { describe, it, expect } from "vitest"
import { mergedPosition, type Position } from "./investments"

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
