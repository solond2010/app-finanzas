import { cookies } from "next/headers"
import { DEMO_COOKIE, isDemoCookieValue } from "@/lib/demo/constants"
import { MainShell } from "./main-shell"
import { currentUserIsAdmin } from "@/lib/server/require-admin"

// El modo demo se decide en el servidor (cookie) y se pasa al cliente: así el
// HTML del servidor y el primer render del navegador coinciden (sin errores
// de hidratación) y el aviso de demo aparece desde el primer pintado.
// El proveedor del menú de Administración solo se monta si el servidor
// confirma que quien está conectado es el admin; en demo o en otra cuenta no
// llega ni el ajuste ni el enlace.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoCookieValue((await cookies()).get(DEMO_COOKIE)?.value)
  const isAdmin = !demo && await currentUserIsAdmin()
  const shell = <MainShell demo={demo}>{children}</MainShell>
  if (!isAdmin) return shell
  const { AdminNavProvider } = await import("@/lib/admin-nav-visibility")
  return <AdminNavProvider>{shell}</AdminNavProvider>
}
