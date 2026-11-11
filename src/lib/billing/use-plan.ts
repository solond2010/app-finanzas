"use client"

import { useEffect, useState } from "react"
import { entitlementsFor, isLifetimeAccess, isPaid, type Entitlements, type Plan } from "@/lib/billing/plans"

export type PlanInfo = {
  enabled: boolean
  plan: Plan
  source: string | null
  lifetime: boolean
  entitlements: Entitlements
  loading: boolean
}

/** Hasta saber el plan, no se bloquea nada: un Pro no debe ver un destello de paywall. */
const UNLOCKED: PlanInfo = {
  enabled: false,
  plan: "free",
  source: null,
  lifetime: false,
  entitlements: entitlementsFor("pro", true),
  loading: true,
}

export function isProAccess(info: Pick<PlanInfo, "enabled" | "plan">): boolean {
  return !info.enabled || isPaid(info.plan)
}

export function usePlan(): PlanInfo {
  const [info, setInfo] = useState<PlanInfo>(UNLOCKED)

  useEffect(() => {
    let alive = true
    fetch("/api/billing/plan", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!alive) return
        if (!body || body.enabled !== true) {
          setInfo({ ...UNLOCKED, loading: false })
          return
        }
        const plan = (body.plan === "pro" || body.plan === "founder" ? body.plan : "free") as Plan
        const source = typeof body.source === "string" ? body.source : null
        setInfo({
          enabled: true,
          plan,
          source,
          lifetime: Boolean(body.lifetime) || isLifetimeAccess(plan, source),
          entitlements: body.entitlements ?? entitlementsFor(plan, true, source),
          loading: false,
        })
      })
      .catch(() => { if (alive) setInfo({ ...UNLOCKED, loading: false }) })
    return () => { alive = false }
  }, [])

  return info
}
