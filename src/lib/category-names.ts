/** Clave para comparar nombres de categoría sin distinguir mayúsculas, tildes
 * ni espacios sobrantes: «Café», «cafe» y « CAFÉ » son la misma categoría. */
export function categoryKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES")
}

export const MAX_CATEGORY_NAME = 40

/** Limpia el nombre que escribe el usuario (espacios, longitud). */
export function cleanCategoryName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, MAX_CATEGORY_NAME)
}

export function findCategoryByName<T extends { name: string }>(categories: T[], name: string): T | undefined {
  const key = categoryKey(name)
  return categories.find((c) => categoryKey(c.name) === key)
}
