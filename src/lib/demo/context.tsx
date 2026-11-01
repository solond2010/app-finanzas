"use client"

import { createContext, useContext, type ReactNode } from "react"

const DemoContext = createContext(false)

export function DemoProvider({ demo, children }: { demo: boolean; children: ReactNode }) {
  return <DemoContext.Provider value={demo}>{children}</DemoContext.Provider>
}

/** true dentro de la demo. Mismo valor en servidor y navegador (viene de la cookie). */
export function useDemo(): boolean {
  return useContext(DemoContext)
}
