"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { type Account } from "@/lib/store"
import { accountDisplayValue } from "@/lib/investments"
import { getSetting, setSetting } from "@/lib/settings"
import { formatMoney, type CurrencyCode } from "@/lib/currency"
import { Sensitive } from "@/components/shared/sensitive"
import { cn } from "@/lib/utils"

const FAV_KEY = "app-finanzas-fav-account"
const TIPO_LABEL: Record<string, string> = { inversion: "Inversión", ahorro: "Ahorro", emergencia: "Emergencia", efectivo: "Efectivo", gastos: "Gastos" }

export function AccountCards({ accounts, valueByAccount, investedByAccount }: { accounts: Account[]; valueByAccount: Record<string, number>; investedByAccount: Record<string, number> }) {
  const [fav, setFav] = useState<string | null>(null)

  useEffect(() => {
    queueMicrotask(async () => {
      try {
        const local = localStorage.getItem(FAV_KEY)
        if (local) setFav(local)
      } catch {
        // ignore
      }
      // Fuente de verdad: Supabase (tabla settings). La caché local solo acelera.
      const remote = await getSetting(FAV_KEY)
      if (remote) {
        setFav(remote)
        try { localStorage.setItem(FAV_KEY, remote) } catch {}
      }
    })
  }, [])

  const toggleFav = (id: string) => {
    const next = fav === id ? null : id
    setFav(next)
    try {
      if (next) localStorage.setItem(FAV_KEY, next)
      else localStorage.removeItem(FAV_KEY)
    } catch {}
    setSetting(FAV_KEY, next ?? "")
  }

  const ordered = [...accounts].sort((a, b) => (a.id === fav ? -1 : b.id === fav ? 1 : 0))

  return (
    <>
      {ordered.map((a) => {
        const isFav = a.id === fav
        const val = accountDisplayValue(a, valueByAccount, investedByAccount)
        return (
          <div
            key={a.id}
            className={cn(
              "relative flex w-[240px] shrink-0 flex-col justify-between rounded-[16px] border p-4 transition-colors duration-300",
              isFav ? "border-transparent bg-primary text-primary-foreground shadow-[0_14px_34px_-20px_var(--primary)]" : "border-border bg-card hover:border-foreground/15"
            )}
          >
            <button
              onClick={() => toggleFav(a.id)}
              aria-label={isFav ? "Quitar de favoritas" : "Marcar como favorita"}
              className={cn("absolute right-3 top-3 transition-colors", isFav ? "text-primary-foreground" : "text-muted-foreground hover:text-amber-500")}
            >
              <Star className={cn("h-4 w-4", isFav && "fill-current")} />
            </button>
            <p className={cn("text-[10px] font-semibold uppercase tracking-wider", isFav ? "text-primary-foreground/70" : "text-muted-foreground")}>
              {TIPO_LABEL[a.tipo] ?? a.tipo}{a.banco ? ` · ${a.banco}` : ""}
            </p>
            <div className="mt-6">
              <p className={cn("truncate text-sm font-semibold", isFav ? "text-primary-foreground" : "text-foreground")}>{a.nombre}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums tracking-tight", isFav ? "text-primary-foreground" : "text-foreground")}>
                <Sensitive>{formatMoney(val, a.currency as CurrencyCode)}</Sensitive>
              </p>
            </div>
          </div>
        )
      })}
    </>
  )
}
