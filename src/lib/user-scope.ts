// Ayudas puras para que TODA escritura quede a nombre del usuario conectado,
// diga lo que diga el navegador. Es una segunda barrera además de RLS.

/** Sobrescribe user_id en cada fila con el del usuario autenticado. */
export function withUserId<T extends Record<string, unknown>>(rows: T[], userId: string): (T & { user_id: string })[] {
  return rows.map((row) => ({ ...row, user_id: userId }))
}

/** Ruta de Storage dentro de la carpeta del usuario (sin "..", sin "/" inicial). */
export function userStoragePath(userId: string, path: string): string | null {
  const clean = path.replace(/^\/+/, "")
  if (!clean || clean.length > 300 || clean.split("/").some((part) => part === ".." || part === ".")) return null
  if (clean.startsWith(`${userId}/`)) return clean
  return `${userId}/${clean}`
}
