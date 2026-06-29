"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

export type AssetKind = "stock" | "fund" | "crypto" | "custom"

export interface Position {
  id: string
  kind: AssetKind
  symbol: string
  name: string
  isin?: string
  date: string
  units: number
  buyPrice: number
  currency: string
  accountId?: string
  dca?: boolean
}

interface InvestmentsContextValue {
  positions: Position[]
  add: (p: Omit<Position, "id">) => void
  remove: (id: string) => void
}

const InvestmentsContext = createContext<InvestmentsContextValue | null>(null)
const STORAGE_KEY = "app-finanzas-investments"

export function InvestmentsProvider({ children }: { children: ReactNode }) {
  const [positions, setPositions] = useState<Position[]>([])

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) setPositions(JSON.parse(raw) as Position[])
      } catch {
        // ignore corrupt storage
      }
    })
  }, [])

  const persist = (next: Position[]) => {
    setPositions(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore quota errors
    }
  }

  const add = (p: Omit<Position, "id">) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    persist([...positions, { ...p, id }])
  }

  const remove = (id: string) => persist(positions.filter((x) => x.id !== id))

  return <InvestmentsContext.Provider value={{ positions, add, remove }}>{children}</InvestmentsContext.Provider>
}

export function useInvestments() {
  const ctx = useContext(InvestmentsContext)
  if (!ctx) throw new Error("useInvestments must be used within InvestmentsProvider")
  return ctx
}
