import { cookies } from "next/headers"
import { DEMO_COOKIE, isDemoCookieValue } from "@/lib/demo/constants"
import { MainShell } from "./main-shell"

// El modo demo se decide en el servidor (cookie) y se pasa al cliente: así el
// HTML del servidor y el primer render del navegador coinciden (sin errores
// de hidratación) y el aviso de demo aparece desde el primer pintado.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemoCookieValue((await cookies()).get(DEMO_COOKIE)?.value)
  return <MainShell demo={demo}>{children}</MainShell>
}
