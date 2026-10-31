import { describe, expect, it } from "vitest"
import { goalProgress, parseGoalRows, suggestedGoalAmounts, cleanGoalName, type WealthGoal } from "./wealth-goals"
import { upcomingMilestones, milestoneStepFor } from "./wealth-milestones"

// Escalera fija anterior (la que se guarda a Moha en la migración).
function ladder(): WealthGoal[] {
  const out: WealthGoal[] = []
  const push = (from: number, to: number, step: number) => { for (let v = from; v <= to; v += step) out.push({ id: `obj_${v}`, amount: v, name: null }) }
  push(2500, 25000, 2500); push(30000, 100000, 5000); push(110000, 250000, 10000); push(275000, 500000, 25000); push(550000, 1000000, 50000); push(1100000, 2000000, 100000)
  return out
}

describe("goalProgress", () => {
  it("con la escalera guardada da lo mismo que los hitos fijos de antes", () => {
    for (const value of [0, 1200, 2500, 7499, 24999, 25000, 61234.5, 99999, 180000, 420000, 999999, 1000000, 1750000]) {
      const p = goalProgress(ladder(), value)
      expect(p.upcoming.map((g) => g.amount)).toEqual(upcomingMilestones(value, 3))
      const step = milestoneStepFor(Math.max(value, 0))
      const oldPrevious = Math.max(upcomingMilestones(value, 1)[0] - step, 0)
      const oldProgress = Math.max(0, Math.min(((value - oldPrevious) / step) * 100, 100))
      expect(p.previousAmount).toBe(oldPrevious)
      expect(p.progress).toBeCloseTo(oldProgress, 6)
    }
  })

  it("sin objetivos no hay siguiente ni progreso", () => {
    const p = goalProgress([], 5000)
    expect(p.next).toBeNull()
    expect(p.upcoming).toEqual([])
    expect(p.allDone).toBe(false)
  })

  it("objetivos propios desordenados y todos conseguidos", () => {
    const goals = [{ id: "b", amount: 10000, name: "Coche" }, { id: "a", amount: 3000, name: null }]
    expect(goalProgress(goals, 4000).next?.name).toBe("Coche")
    expect(goalProgress(goals, 4000).progress).toBeCloseTo(((4000 - 3000) / 7000) * 100)
    const done = goalProgress(goals, 20000)
    expect(done.allDone).toBe(true)
    expect(done.next).toBeNull()
    expect(done.trail.map((g) => g.id)).toEqual(["b"])
  })
})

describe("parseGoalRows / cleanGoalName / suggestedGoalAmounts", () => {
  it("convierte numeric en número, descarta filas malas y ordena", () => {
    expect(parseGoalRows([{ id: "x", amount: "5000.00", name: "  Piso  " }, { id: "y", amount: -1 }, { id: 3, amount: 1 }, { id: "z", amount: 1000, name: "" }]))
      .toEqual([{ id: "z", amount: 1000, name: null }, { id: "x", amount: 5000, name: "Piso" }])
  })
  it("recorta nombres largos", () => {
    expect(cleanGoalName("a".repeat(60))).toHaveLength(40)
  })
  it("sugiere los siguientes escalones según el patrimonio", () => {
    expect(suggestedGoalAmounts(0)).toEqual([2500, 5000, 7500, 10000, 12500])
    expect(suggestedGoalAmounts(26000, 2)).toEqual([30000, 35000])
  })
})

import { parseEuroInput } from "./wealth-goals"
describe("parseEuroInput", () => {
  it("entiende importes escritos a la española", () => {
    expect(parseEuroInput("2.500")).toBe(2500)
    expect(parseEuroInput("2500")).toBe(2500)
    expect(parseEuroInput("2.500,50 €")).toBe(2500.5)
    expect(parseEuroInput("1500,5")).toBe(1500.5)
    expect(parseEuroInput("1.000.000")).toBe(1000000)
    expect(parseEuroInput("2.5")).toBe(2.5)
    expect(parseEuroInput("0")).toBeNull()
    expect(parseEuroInput("abc")).toBeNull()
    expect(parseEuroInput("")).toBeNull()
  })
})
