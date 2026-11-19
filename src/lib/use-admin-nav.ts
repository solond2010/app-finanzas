"use client"

import { useEffect, useState } from "react"
import { useAdminNavVisibility } from "@/lib/admin-nav-visibility"

// Menú «Administración»: el servidor es quien decide si hay sesión de admin
// (AdminNavProvider). Aquí solo se cuenta el badge de comentarios sin revisar
// y se respeta la preferencia de ocultarlo en este dispositivo.

let summary: Promise<number> | null = null

function loadNuevos() {
  if (!summary) {
    summary = fetch("/api/admin/resumen", { cache: "no-store" })
      .then(async (res) => {
        const data = res.ok ? ((await res.json().catch(() => null)) as { nuevos?: number } | null) : null
        return Math.max(0, Number(data?.nuevos) || 0)
      })
      .catch(() => 0)
  }
  return summary
}

/** Al volver de /admin (donde se marcan como vistos) se vuelve a contar. */
export function refreshAdminNav() {
  summary = null
}

export function useAdminNav(pathname: string) {
  const visibility = useAdminNavVisibility()
  const [nuevos, setNuevos] = useState(0)

  useEffect(() => {
    if (!visibility.isAdminSession) {
      setNuevos(0)
      return
    }
    let alive = true
    if (pathname.startsWith("/admin")) refreshAdminNav()
    void loadNuevos().then((value) => { if (alive) setNuevos(value) })
    return () => { alive = false }
  }, [pathname, visibility.isAdminSession])

  return {
    isAdmin: visibility.isAdminSession,
    showAdminLink: visibility.showAdminLink,
    nuevos: visibility.showAdminLink ? nuevos : 0,
  }
}

export const ADMIN_HREF = "/admin"
