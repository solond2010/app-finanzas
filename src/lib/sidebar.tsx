"use client"

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"

interface SidebarContextType {
  open: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    // Restaura la preferencia persistida tras la hidratación. No puede ir en el
    // inicializador de useState porque provocaría un hydration mismatch (el SSR
    // no tiene acceso a localStorage).
    const saved = localStorage.getItem("app-finanzas-sidebar")
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "false") setOpen(false)
  }, [])

  const toggle = useCallback(() => {
    setOpen((p) => {
      const next = !p
      localStorage.setItem("app-finanzas-sidebar", String(next))
      return next
    })
  }, [])

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider")
  return ctx
}
