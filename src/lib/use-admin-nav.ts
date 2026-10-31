"use client"

import { useEffect, useState } from "react"
import { fetchMe } from "@/lib/use-me"

// Menú «Administración»: solo aparece si /api/auth/me dice isAdmin (la misma
// comprobación de servidor que usa /api/admin). Para el admin, además, el
// número de comentarios sin revisar. Una petición compartida por carga.
let summary: Promise<{ isAdmin: boolean; nuevos: number }> | null = null

function loadSummary() {
  if (!summary) {
    summary = fetchMe().then(async (me) => {
      if (!me?.isAdmin) return { isAdmin: false, nuevos: 0 }
      const res = await fetch("/api/admin/resumen", { cache: "no-store" }).catch(() => null)
      const data = res?.ok ? ((await res.json().catch(() => null)) as { nuevos?: number } | null) : null
      return { isAdmin: true, nuevos: Math.max(0, Number(data?.nuevos) || 0) }
    })
  }
  return summary
}

/** Al volver de /admin (donde se marcan como vistos) se vuelve a contar. */
export function refreshAdminNav() {
  summary = null
}

export function useAdminNav(pathname: string) {
  const [state, setState] = useState({ isAdmin: false, nuevos: 0 })
  useEffect(() => {
    let alive = true
    if (pathname.startsWith("/admin")) refreshAdminNav()
    void loadSummary().then((value) => { if (alive) setState(value) })
    return () => { alive = false }
  }, [pathname])
  return state
}

export const ADMIN_HREF = "/admin"
