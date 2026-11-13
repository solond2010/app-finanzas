/** Clave para comparar nombres de categoría sin distinguir mayúsculas, tildes
 * ni espacios sobrantes: «Café», «cafe» y « CAFÉ » son la misma categoría. */
export function categoryKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES")
}

export const MAX_CATEGORY_NAME = 40

export type CategoryKindName = "ingreso" | "gasto" | "both"

/** Limpia el nombre que escribe el usuario (espacios, longitud). */
export function cleanCategoryName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_CATEGORY_NAME)
}

export function findCategoryByName<T extends { name: string }>(categories: T[], name: string): T | undefined {
  const key = categoryKey(name)
  return categories.find((c) => categoryKey(c.name) === key)
}

/** Etiqueta en plural, para avisos del tipo «Ya existe en Ingresos». */
export function categoryKindLabel(kind?: CategoryKindName): string {
  if (kind === "ingreso") return "Ingresos"
  if (kind === "gasto") return "Gastos"
  return "Ambos"
}

/** El mismo nombre choca si alguno es «ambos» (o no tiene tipo) o si coinciden. */
export function categoryKindsConflict(a?: CategoryKindName, b?: CategoryKindName): boolean {
  const left = a ?? "both"
  const right = b ?? "both"
  if (left === "both" || right === "both") return true
  return left === right
}

/** Bloquea un alta/renombre: mismo nombre normalizado y tipo conflictivo. */
export function findBlockingCategory<T extends { name: string; kind?: CategoryKindName }>(
  categories: T[],
  name: string,
  kind?: CategoryKindName,
): T | undefined {
  const key = categoryKey(name)
  if (!key) return undefined
  return categories.find((c) => categoryKey(c.name) === key && categoryKindsConflict(c.kind, kind))
}

export function alreadyExistsInMessage(kind?: CategoryKindName): string {
  return `Ya existe en ${categoryKindLabel(kind)}`
}

/** Un movimiento encaja con una categoría de ese tipo (las txs se guardan por nombre). */
export function transactionMatchesCategoryKind(
  transaction: { tipo: string },
  kind?: CategoryKindName,
): boolean {
  if (!kind || kind === "both") return true
  return transaction.tipo === kind
}
