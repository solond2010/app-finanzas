"use client"

import { useEffect, useRef } from "react"
import { useFinance } from "@/lib/store"
import { useToast } from "@/components/ui/toast"
import { formatMoney } from "@/lib/currency"
import { limitWorsened, monthlyLimitStatus, type LimitLevel } from "@/lib/monthly-limit"

/**
 * Avisa con un toast cuando un gasto hace que una cuenta con «Límite mensual»
 * llegue al 80 % o lo supere. La primera carga solo memoriza el estado, para
 * no avisar de algo que ya estaba así al abrir la app.
 */
export function LimitWatcher() {
  const { state, loading } = useFinance()
  const { toast } = useToast()
  const levels = useRef<Map<string, LimitLevel> | null>(null)

  useEffect(() => {
    if (loading) return
    const next = new Map<string, LimitLevel>()
    for (const account of state.accounts) {
      const status = monthlyLimitStatus(account, state.transactions)
      if (!status) continue
      next.set(account.id, status.level)
      const before = levels.current?.get(account.id)
      if (levels.current && limitWorsened(before, status.level)) {
        if (status.level === "over") {
          toast(`Te has pasado ${formatMoney(status.over, account.currency)} del límite mensual de ${account.nombre}`, "error")
        } else {
          toast(`${account.nombre}: llevas el ${Math.round(status.pct)} % del límite mensual (quedan ${formatMoney(status.remaining, account.currency)})`, "info")
        }
      }
    }
    levels.current = next
  }, [loading, state.accounts, state.transactions, toast])

  return null
}
