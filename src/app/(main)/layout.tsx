import { cookies } from "next/headers"
import { DEMO_COOKIE, isDemoCookieValue } from "@/lib/demo/constants"
import { MainShell } from "./main-shell"
import { currentUserIsAdmin } from "@/lib/server/require-admin"
import { HIDE_ADMIN_NAV_COOKIE, isHiddenAdminNavValue } from "@/lib/server/admin-nav-cookie"

// El modo demo se decide en el servidor (cookie) y se pasa al cliente: así el
// HTML del servidor y el primer render del navegador coinciden (sin errores
// de hidratación) y el aviso de demo aparece desde el primer pintado.
// El enlace de Administración solo se activa si el servidor confirma que
// quien está conectado es el admin y no lo ha ocultado en este dispositivo.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const demo = isDemoCookieValue(jar.get(DEMO_COOKIE)?.value)
  const isAdmin = !demo && await currentUserIsAdmin()
  const showAdminNav = isAdmin && !isHiddenAdminNavValue(jar.get(HIDE_ADMIN_NAV_COOKIE)?.value)
  return <MainShell demo={demo} showAdminNav={showAdminNav}>{children}</MainShell>
}
