// Comprobación de versión: la app anclada al inicio en iPhone (modo
// standalone) se queda viva en memoria y nunca vuelve a pedir el HTML, así
// que seguía mostrando la versión vieja tras cada despliegue. El cliente
// compara su versión de compilación con la del servidor y se recarga.

/** Versión con la que se compiló este bundle ("dev" en local). */
export const RUNNING_VERSION = process.env.NEXT_PUBLIC_BUILD_ID || "dev"

export type UpdateDecision = "none" | "reload" | "prompt"

export function decideUpdate({ running, remote, safe, alreadyReloadedFor }: {
  running: string
  remote: string | null | undefined
  /** Sin diálogos abiertos ni el usuario escribiendo. */
  safe: boolean
  /** Versión para la que ya se recargó en esta pestaña (evita bucles). */
  alreadyReloadedFor: string | null
}): UpdateDecision {
  if (!remote || remote === "dev" || running === "dev" || remote === running) return "none"
  // Si ya recargamos por esta versión y seguimos con la vieja (caché de
  // algún intermediario), no se insiste: se ofrece el botón y ya.
  if (alreadyReloadedFor === remote) return "prompt"
  return safe ? "reload" : "prompt"
}
