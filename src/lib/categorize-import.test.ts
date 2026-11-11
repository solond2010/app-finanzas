import { describe, expect, it } from "vitest"
import { suggestCategory } from "./categorize-import"

const cats = [
  { name: "Supermercado", kind: "gasto" as const },
  { name: "Hogar", kind: "gasto" as const },
  { name: "Suministros", kind: "gasto" as const },
  { name: "Suscripciones", kind: "gasto" as const },
  { name: "Coche", kind: "gasto" as const },
  { name: "Salario", kind: "ingreso" as const },
  { name: "Otros gastos", kind: "gasto" as const },
  { name: "Otros ingresos", kind: "ingreso" as const },
]

describe("categorización al importar", () => {
  it("aprende de un concepto que el usuario ya clasificó", () => {
    const history = [
      { descripcion: "MERCADONA AV. DEL PUERTO", categoria: "Supermercado", tipo: "gasto" as const },
      { descripcion: "MERCADONA 3482", categoria: "Supermercado", tipo: "gasto" as const },
    ]
    const s = suggestCategory("MERCADONA 1100", "gasto", history, cats)
    expect(s).toEqual({ category: "Supermercado", source: "learned" })
  })

  it("si no hay historial, usa palabras clave y deja la categoría editable", () => {
    expect(suggestCategory("ENDESA FACTURA", "gasto", [], cats)).toEqual({ category: "Suministros", source: "suggested" })
    expect(suggestCategory("NETFLIX.COM", "gasto", [], cats)).toEqual({ category: "Suscripciones", source: "suggested" })
    expect(suggestCategory("REPSOL EL CIERVO", "gasto", [], cats)).toEqual({ category: "Coche", source: "suggested" })
    expect(suggestCategory("NOMINA ACME SL", "ingreso", [], cats)).toEqual({ category: "Salario", source: "suggested" })
  })

  it("si no reconoce el concepto, cae a Otros y no inventa categorías que el usuario no tiene", () => {
    const s = suggestCategory("BIZUM ANA", "gasto", [], cats.filter((c) => c.name !== "Transferencia"))
    expect(s.source).toBe("none")
    expect(s.category).toBe("Otros gastos")
    const limited = suggestCategory("ENDESA FACTURA", "gasto", [], [{ name: "Hogar", kind: "gasto" }, { name: "Otros gastos", kind: "gasto" }])
    expect(limited).toEqual({ category: "Hogar", source: "suggested" })
  })
})
