/** Color por defecto en memoria o al crear una categoría nueva. No se usa para rellenar filas ya existentes. */
export const DEFAULT_CATEGORY_COLOR = "#3b82f6"

export function isMissingCategoryColor(color: unknown): boolean {
  return typeof color !== "string" || color.trim() === ""
}

export function normalizeCategoryColor(color: unknown, fallback = DEFAULT_CATEGORY_COLOR): string {
  if (typeof color === "string" && color.trim() !== "") return color.trim()
  return fallback
}

/**
 * En un alta, el color vacío se rellena. En una fila que ya existe, un color
 * vacío u omitido no se envía, para no escribir en la BD un valor que solo
 * se normalizó al cargar.
 */
export function prepareCategoryRowsForUpsert(
  rows: Record<string, unknown>[],
  existingIds: Set<string>,
): Record<string, unknown>[] {
  return rows.map((row) => {
    const id = typeof row.id === "string" ? row.id : ""
    const isNew = !id || !existingIds.has(id)
    if (isNew) {
      return { ...row, color: normalizeCategoryColor(row.color) }
    }
    if (!("color" in row) || isMissingCategoryColor(row.color)) {
      const { color: _color, ...rest } = row
      return rest
    }
    return row
  })
}
