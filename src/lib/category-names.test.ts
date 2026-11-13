import { describe, expect, it } from "vitest"
import {
  alreadyExistsInMessage,
  categoryKey,
  categoryKindLabel,
  categoryKindsConflict,
  cleanCategoryName,
  findBlockingCategory,
  findCategoryByName,
  transactionMatchesCategoryKind,
} from "./category-names"

describe("nombres de categoría", () => {
  it("ignora mayúsculas, tildes y espacios", () => {
    expect(categoryKey("  Café  ")).toBe(categoryKey("cafe"))
    expect(categoryKey("Educación")).toBe("educacion")
    expect(categoryKey("Ocio  nocturno")).toBe("ocio nocturno")
  })
  it("encuentra duplicados", () => {
    const cats = [{ name: "Suscripciones" }, { name: "Alimentación" }]
    expect(findCategoryByName(cats, "alimentacion")?.name).toBe("Alimentación")
    expect(findCategoryByName(cats, "Gimnasio")).toBeUndefined()
  })
  it("limpia el nombre", () => {
    expect(cleanCategoryName("  Mascotas   y  veterinario ")).toBe("Mascotas y veterinario")
    expect(cleanCategoryName("x".repeat(80))).toHaveLength(40)
  })
})

describe("duplicados por nombre y tipo", () => {
  const inversionIngreso = { name: "Inversión", kind: "ingreso" as const }
  const inversionGasto = { name: "Inversión", kind: "gasto" as const }
  const ambos = { name: "Inversión", kind: "both" as const }

  it("permite el mismo nombre en gasto y en ingreso", () => {
    expect(findBlockingCategory([inversionIngreso], "Inversión", "gasto")).toBeUndefined()
    expect(findBlockingCategory([inversionGasto], "inversion", "ingreso")).toBeUndefined()
    expect(categoryKindsConflict("ingreso", "gasto")).toBe(false)
  })

  it("bloquea el mismo tipo, aunque cambien mayúsculas o tildes", () => {
    expect(findBlockingCategory([inversionIngreso], "  inversion  ", "ingreso")?.name).toBe("Inversión")
    expect(findBlockingCategory([inversionGasto], "INVERSIÓN", "gasto")?.name).toBe("Inversión")
  })

  it("bloquea si ya existe en Ambos, o si se intenta crear como Ambos", () => {
    expect(findBlockingCategory([ambos], "Inversión", "gasto")?.kind).toBe("both")
    expect(findBlockingCategory([inversionIngreso], "Inversión", "both")?.kind).toBe("ingreso")
  })

  it("redacta el aviso con el sitio donde ya está", () => {
    expect(categoryKindLabel("ingreso")).toBe("Ingresos")
    expect(alreadyExistsInMessage("ingreso")).toBe("Ya existe en Ingresos")
    expect(alreadyExistsInMessage("gasto")).toBe("Ya existe en Gastos")
    expect(alreadyExistsInMessage("both")).toBe("Ya existe en Ambos")
  })

  it("solo atribuye movimientos del tipo de esa categoría", () => {
    expect(transactionMatchesCategoryKind({ tipo: "gasto" }, "gasto")).toBe(true)
    expect(transactionMatchesCategoryKind({ tipo: "ingreso" }, "gasto")).toBe(false)
    expect(transactionMatchesCategoryKind({ tipo: "gasto" }, "both")).toBe(true)
    expect(transactionMatchesCategoryKind({ tipo: "ingreso" }, undefined)).toBe(true)
  })
})
