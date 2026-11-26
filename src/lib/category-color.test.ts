import { describe, expect, it } from "vitest"
import { DEFAULT_CATEGORY_COLOR, isMissingCategoryColor, normalizeCategoryColor, prepareCategoryRowsForUpsert } from "./category-color"

describe("category-color", () => {
  it("detecta color null, indefinido o en blanco", () => {
    expect(isMissingCategoryColor(null)).toBe(true)
    expect(isMissingCategoryColor(undefined)).toBe(true)
    expect(isMissingCategoryColor("")).toBe(true)
    expect(isMissingCategoryColor("   ")).toBe(true)
    expect(isMissingCategoryColor(DEFAULT_CATEGORY_COLOR)).toBe(false)
  })

  it("normaliza el color vacío al valor por defecto", () => {
    expect(normalizeCategoryColor(null)).toBe(DEFAULT_CATEGORY_COLOR)
    expect(normalizeCategoryColor("")).toBe(DEFAULT_CATEGORY_COLOR)
    expect(normalizeCategoryColor("#ef4444")).toBe("#ef4444")
  })

  it("al crear una categoría le pone color por defecto y no rellena una existente vacía", () => {
    const existing = new Set(["cat_old"])
    const rows = prepareCategoryRowsForUpsert(
      [
        { id: "cat_new", name: "Nueva", color: null },
        { id: "cat_old", name: "Antigua", color: null },
        { id: "cat_old", name: "Antigua", color: "#ef4444" },
      ],
      existing,
    )
    expect(rows[0]).toEqual({ id: "cat_new", name: "Nueva", color: DEFAULT_CATEGORY_COLOR })
    expect(rows[1]).toEqual({ id: "cat_old", name: "Antigua" })
    expect("color" in rows[1]).toBe(false)
    expect(rows[2]).toEqual({ id: "cat_old", name: "Antigua", color: "#ef4444" })
  })
})
