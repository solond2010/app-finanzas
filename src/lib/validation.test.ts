import { describe, it, expect } from "vitest"
import { parseAmount, parseAmountOrZero } from "./validation"

describe("parseAmount", () => {
  it("acepta un número positivo", () => {
    expect(parseAmount("42.5")).toBe(42.5)
  })
  it("acepta coma decimal", () => {
    expect(parseAmount("42,5")).toBe(42.5)
  })
  it("rechaza cero", () => {
    expect(parseAmount("0")).toBeNull()
  })
  it("rechaza negativos", () => {
    expect(parseAmount("-50")).toBeNull()
  })
  it("rechaza texto no numérico (antes se colaba como NaN)", () => {
    expect(parseAmount("abc")).toBeNull()
  })
  it("rechaza vacío", () => {
    expect(parseAmount("")).toBeNull()
    expect(parseAmount("   ")).toBeNull()
  })
})

describe("parseAmountOrZero", () => {
  it("trata el campo vacío como 0", () => {
    expect(parseAmountOrZero("")).toBe(0)
  })
  it("acepta 0 explícito", () => {
    expect(parseAmountOrZero("0")).toBe(0)
  })
  it("acepta un positivo", () => {
    expect(parseAmountOrZero("120")).toBe(120)
  })
  it("devuelve NaN ante texto no numérico, para que el llamador lo rechace explícitamente", () => {
    expect(Number.isNaN(parseAmountOrZero("abc"))).toBe(true)
  })
  it("devuelve NaN ante negativos (no admitidos aquí)", () => {
    expect(Number.isNaN(parseAmountOrZero("-10"))).toBe(true)
  })
})
