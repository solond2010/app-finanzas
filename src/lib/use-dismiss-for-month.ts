"use client"

import { useEffect, useState } from "react"
import { getSetting, setSetting } from "@/lib/settings"
import { useMe } from "@/lib/use-me"
import { dismissStorageKey, isDismissedThisMonth, madridMonthKey } from "@/lib/dashboard-banners"

/**
 * Cierre de un aviso hasta el mes siguiente (Europe/Madrid).
 * Primero lee el dispositivo (instantáneo), luego la nube (`settings` por usuario)
 * para que el cierre aguante entre aparatos.
 */
export function useDismissForMonth(settingKey: string) {
  const { me, loaded } = useMe()
  const userId = me?.userId ?? "local"
  const [stored, setStored] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const currentMonth = madridMonthKey()

  useEffect(() => {
    if (!loaded) return
    let alive = true
    let local: string | null = null
    try { local = localStorage.getItem(dismissStorageKey(settingKey, userId)) } catch { /* sin almacenamiento local */ }
    if (local) setStored(local)
    setReady(true)
    void getSetting(settingKey).then((remote) => {
      if (!alive) return
      const value = typeof remote === "string" && remote ? remote : local
      if (!value) return
      setStored(value)
      try { localStorage.setItem(dismissStorageKey(settingKey, userId), value) } catch { /* la nube ya lo tiene */ }
    })
    return () => { alive = false }
  }, [loaded, userId, settingKey])

  const hidden = isDismissedThisMonth(stored, currentMonth)

  const dismiss = () => {
    setStored(currentMonth)
    try { localStorage.setItem(dismissStorageKey(settingKey, userId), currentMonth) } catch { /* se guarda igualmente en la nube */ }
    void setSetting(settingKey, currentMonth)
  }

  return { hidden, dismiss, ready }
}
