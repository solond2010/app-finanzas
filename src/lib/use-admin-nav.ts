"use client"

import { useEffect, useState } from "react"

// Badge de comentarios sin revisar. El servidor es quien decide si el enlace
// de Administración aparece (prop showAdminNav); si no, no se llama a la API.

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

export function useAdminNav(pathname: string, showAdminNav = false) {
  const [nuevos, setNuevos] = useState(0)

  useEffect(() => {
    if (!showAdminNav) {
      setNuevos(0)
      return
    }
    let alive = true
    if (pathname.startsWith("/admin")) refreshAdminNav()
    void loadNuevos().then((value) => { if (alive) setNuevos(value) })
    return () => { alive = false }
  }, [pathname, showAdminNav])

  return {
    isAdmin: showAdminNav,
    showAdminLink: showAdminNav,
    nuevos: showAdminNav ? nuevos : 0,
  }
}

export const ADMIN_HREF = "/admin"
