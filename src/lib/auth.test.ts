import { describe, it, expect } from "vitest"
import { timingSafeEqualString } from "./auth"

describe("timingSafeEqualString", () => {
  it("es true cuando ambas cadenas son idénticas", () => {
    expect(timingSafeEqualString("secreto123", "secreto123")).toBe(true)
  })
  it("es false ante cualquier diferencia de un carácter", () => {
    expect(timingSafeEqualString("secreto123", "secreto124")).toBe(false)
  })
  it("es false ante longitudes distintas", () => {
    expect(timingSafeEqualString("corto", "muchomaslarga")).toBe(false)
  })
  it("es false comparado con cadena vacía (salvo ambas vacías)", () => {
    expect(timingSafeEqualString("algo", "")).toBe(false)
    expect(timingSafeEqualString("", "")).toBe(true)
  })
})
