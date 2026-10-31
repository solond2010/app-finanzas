import { describe, expect, it } from "vitest"
import { categoryKey, cleanCategoryName, findCategoryByName } from "./category-names"

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
