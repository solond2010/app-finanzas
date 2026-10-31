"use client"

import { useEffect, useState } from "react"

export type Me = { mode: "accounts" | "password"; userId: string; email: string | null; isAdmin?: boolean }

// Una sola petición a /api/auth/me por carga de página, compartida por todos
// los componentes que necesitan saber quién está conectado.
let mePromise: Promise<Me | null> | null = null

export function fetchMe(): Promise<Me | null> {
  if (!mePromise) {
    mePromise = fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => (res.ok ? ((await res.json().catch(() => null)) as Me | null) : null))
      .catch(() => null)
      .then((me) => { if (!me) mePromise = null; return me })
  }
  return mePromise
}

export function useMe(): { me: Me | null; loaded: boolean } {
  const [state, setState] = useState<{ me: Me | null; loaded: boolean }>({ me: null, loaded: false })
  useEffect(() => {
    let alive = true
    void fetchMe().then((me) => { if (alive) setState({ me, loaded: true }) })
    return () => { alive = false }
  }, [])
  return state
}
