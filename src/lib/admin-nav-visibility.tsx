"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

// Preferencia por dispositivo: oculta el enlace de Administración en este
// navegador. Solo montamos el proveedor cuando el servidor ya ha comprobado
// que el usuario es admin; el resto de cuentas no llega a cargar este estado.

export const HIDE_ADMIN_NAV_KEY = "garra-hide-admin-nav"

type AdminNavVisibility = {
  isAdminSession: boolean
  ready: boolean
  hidden: boolean
  setHidden: (hidden: boolean) => void
  showAdminLink: boolean
}

const AdminNavVisibilityContext = createContext<AdminNavVisibility | null>(null)

export function AdminNavProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [hidden, setHiddenState] = useState(false)

  useEffect(() => {
    setHiddenState(localStorage.getItem(HIDE_ADMIN_NAV_KEY) === "true")
    setReady(true)
  }, [])

  const setHidden = useCallback((value: boolean) => {
    setHiddenState(value)
    localStorage.setItem(HIDE_ADMIN_NAV_KEY, value ? "true" : "false")
  }, [])

  const value = useMemo<AdminNavVisibility>(() => ({
    isAdminSession: true,
    ready,
    hidden,
    setHidden,
    showAdminLink: ready && !hidden,
  }), [ready, hidden, setHidden])

  return <AdminNavVisibilityContext.Provider value={value}>{children}</AdminNavVisibilityContext.Provider>
}

const GUEST: AdminNavVisibility = {
  isAdminSession: false,
  ready: true,
  hidden: false,
  setHidden: () => {},
  showAdminLink: false,
}

export function useAdminNavVisibility(): AdminNavVisibility {
  return useContext(AdminNavVisibilityContext) ?? GUEST
}
