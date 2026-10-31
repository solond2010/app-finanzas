import { describe, expect, it } from "vitest"
import { transferDescription } from "./transfer-description"

describe("descripción de traspasos", () => {
  it("sin texto propio dice de dónde a dónde", () => {
    expect(transferDescription("Traspaso", "Cuenta nómina", "Ahorro")).toBe("Traspaso de Cuenta nómina a Ahorro")
    expect(transferDescription("", "A", "B")).toBe("Traspaso de A a B")
  })
  it("conserva la descripción del usuario", () => {
    expect(transferDescription("Viaje a Japón", "Nómina", "Ahorro viaje")).toBe("Viaje a Japón · de Nómina a Ahorro viaje")
  })
  it("no usa flechas", () => {
    expect(transferDescription("Traspaso", "A", "B")).not.toMatch(/[→←]/)
  })
})
