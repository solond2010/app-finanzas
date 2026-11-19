import "server-only"
import { getDataContext, type DataContext } from "@/lib/server/request-context"
import { isAdminUserId } from "@/lib/auth-mode"

/** ¿Es el usuario de esta petición el admin? Ante cualquier error, no. */
export async function currentUserIsAdmin(): Promise<boolean> {
  try {
    const ctx = await getDataContext()
    return Boolean(ctx && isAdminUserId(ctx.userId))
  } catch {
    return false
  }
}

/** Contexto de la petición solo si el usuario es admin; si no, null. */
export async function requireAdmin(): Promise<DataContext | null> {
  try {
    const ctx = await getDataContext()
    if (!ctx || !isAdminUserId(ctx.userId)) return null
    return ctx
  } catch {
    return null
  }
}
