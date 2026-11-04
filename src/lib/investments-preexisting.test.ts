import { describe, expect, it } from "vitest"
import { purchaseContributions } from "./investments"
import { computeInvestments } from "./portfolio"

const T = new Date().toISOString().slice(0, 10)
describe("posición que ya tenías", () => {
  it("una compra normal cuenta como aportación; una de partida no", () => {
    expect(purchaseContributions(1000, T)).toEqual([{ amount: 1000, date: T }])
    expect(purchaseContributions(1000, T, { preexisting: true })).toEqual([{ amount: 0, date: T }])
  })
  it("solo «Aportas este mes» entra en las aportaciones del mes", () => {
    const pos = { id: "p", kind: "custom" as const, symbol: "custom:x", name: "X", date: T, units: 10, buyPrice: 100, currency: "EUR", accountId: "a" }
    const contribs = purchaseContributions(1000, T, { preexisting: true, thisMonth: 150, today: T }).map((c, i) => ({ id: String(i), positionId: "p", ...c }))
    const view = computeInvestments([], [pos], {}, contribs)
    expect(view.months[view.months.length - 1].amount).toBe(150)
  })
})
