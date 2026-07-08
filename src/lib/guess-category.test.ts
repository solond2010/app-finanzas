import { describe, it, expect } from "vitest"
import { guessCategory } from "./guess-category"

describe("guessCategory", () => {
  it("detecta supermercado", () => {
    expect(guessCategory("Mercadona compra semanal", "gasto")).toBe("Supermercado")
  })

  it("detecta transporte", () => {
    expect(guessCategory("Uber al aeropuerto", "gasto")).toBe("Transporte")
  })

  it("no distingue mayúsculas/minúsculas", () => {
    expect(guessCategory("CAFÉ con Ana", "gasto")).toBe("Restaurantes")
  })

  it("usa las reglas de ingreso solo para tipo ingreso", () => {
    expect(guessCategory("Nómina de julio", "ingreso")).toBe("Salario")
    expect(guessCategory("Nómina de julio", "gasto")).toBe("Otros")
  })

  it("cae en Otros si no hay ninguna coincidencia", () => {
    expect(guessCategory("xyz sin sentido", "gasto")).toBe("Otros")
    expect(guessCategory("", "ingreso")).toBe("Otros")
  })
})
