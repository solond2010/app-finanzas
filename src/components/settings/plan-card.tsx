"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { PRICES_EUR, isLifetimeAccess, type CheckoutOption, type Entitlements, type Plan } from "@/lib/billing/plans"
import { cn } from "@/lib/utils"

type PlanInfo = {
  enabled: true
  plan: Plan
  source: string | null
  lifetime?: boolean
  renews: string | null
  entitlements: Entitlements
}

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" })

const FREE_FEATURES: { label: string; ok: boolean }[] = [
  { label: "Hasta 3 cuentas", ok: true },
  { label: "Sin inversiones", ok: false },
  { label: "Sin historial de patrimonio", ok: false },
  { label: "Sin análisis avanzado", ok: false },
  { label: "Sin exportación", ok: false },
]

const PRO_FEATURES: { label: string; ok: boolean }[] = [
  { label: "Cuentas ilimitadas", ok: true },
  { label: "Inversiones", ok: true },
  { label: "Historial de patrimonio", ok: true },
  { label: "Análisis avanzado", ok: true },
  { label: "Exportación", ok: true },
]

function FeatureList({ items }: { items: { label: string; ok: boolean }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.label} className={cn("flex items-center gap-2 text-sm", item.ok ? "text-foreground" : "text-muted-foreground")}>
          <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px] font-bold", item.ok ? "bg-accent-green/15 text-accent-green" : "bg-accent-red/15 text-accent-red")} aria-hidden>
            {item.ok ? "✓" : "×"}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function planLabel(plan: Plan, source: string | null): string {
  if (plan === "founder") return "Pro de por vida"
  if (plan === "pro" && source === "early_access") return "Pro para siempre (usuario de la beta)"
  if (plan === "pro" && source === "first_fifty") return "Pro para siempre (uno de los 50 primeros)"
  if (plan === "pro" && source === "manual") return "Pro para siempre"
  if (plan === "pro") return "Pro"
  return "Gratis"
}

/** Tarjeta «Tu plan». No se muestra nada mientras los pagos estén apagados. */
export function PlanCard() {
  const [info, setInfo] = useState<PlanInfo | null>(null)
  const [busy, setBusy] = useState<CheckoutOption | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    let alive = true
    fetch("/api/billing/plan", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (alive && body?.enabled === true) setInfo(body as PlanInfo) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (!info) return null

  async function buy(option: CheckoutOption) {
    setBusy(option)
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ option }) })
      const body = await res.json().catch(() => null)
      if (res.ok && typeof body?.url === "string") { window.location.href = body.url; return }
      toast(body?.error ?? "No se pudo abrir el pago", "error")
    } catch {
      toast("No se pudo abrir el pago", "error")
    }
    setBusy(null)
  }

  const lifetime = info.lifetime ?? isLifetimeAccess(info.plan, info.source)
  const label = planLabel(info.plan, info.source)

  return (
    <Card>
      <CardHeader><CardTitle>Tu plan</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {lifetime ? (
          <div className="rounded-[14px] border-2 border-primary bg-card p-5 shadow-[0_0_0_4px_rgb(245_165_36_/_8%)]">
            <p className="mb-3 inline-flex rounded-full border border-primary bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {info.source === "first_fifty" ? "Uno de los 50 primeros" : info.source === "early_access" ? "Usuario de la beta" : "Pro de por vida"}
            </p>
            <p className="font-heading text-2xl font-bold tracking-tight">{label}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {info.source === "first_fifty"
                ? "Formas parte de los 50 primeros usuarios. Tienes Garra Pro incluido, sin fecha de caducidad."
                : "Tienes Garra Pro para siempre. No tienes que pagar nada más."}
            </p>
            <div className="mt-4 border-t border-border pt-4">
              <FeatureList items={PRO_FEATURES} />
            </div>
          </div>
        ) : info.plan === "pro" ? (
          <div className="space-y-3">
            <p className="text-sm">
              <span className="font-semibold">{label}</span>
              {info.renews && <span className="text-muted-foreground"> · se renueva el {new Date(info.renews).toLocaleDateString("es-ES")}</span>}
            </p>
            <FeatureList items={PRO_FEATURES} />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">Elige cómo quieres usar Garra. Los 50 primeros usuarios registrados tienen Pro incluido.</p>
            <div className="grid gap-3 lg:grid-cols-3">
              <div className="flex flex-col rounded-[14px] border border-border bg-card p-4">
                <p className="mb-2 inline-flex w-fit rounded-full border border-accent-green/40 bg-accent-green/10 px-2 py-0.5 text-[11px] font-semibold text-accent-green">Tu plan actual</p>
                <p className="font-heading text-lg font-bold">Gratis</p>
                <p className="font-heading text-2xl font-bold text-primary">0 €</p>
                <div className="mt-3 grow"><FeatureList items={FREE_FEATURES} /></div>
              </div>
              <div className="flex flex-col rounded-[14px] border-2 border-primary bg-card p-4 shadow-[0_0_0_4px_rgb(245_165_36_/_8%)]">
                <p className="mb-2 inline-flex w-fit rounded-full border border-primary bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">Recomendado</p>
                <p className="font-heading text-lg font-bold">Pro mensual</p>
                <p className="font-heading text-2xl font-bold text-primary">{eur(PRICES_EUR.pro_monthly)} <span className="text-sm font-medium text-muted-foreground">/ mes</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Se renueva cada mes. Cancela cuando quieras.</p>
                <div className="mt-3 grow"><FeatureList items={PRO_FEATURES} /></div>
                <Button className="mt-4 w-full" disabled={!!busy} onClick={() => buy("pro_monthly")}>{busy === "pro_monthly" ? "Abriendo…" : "Pasar a Pro"}</Button>
              </div>
              <div className="flex flex-col rounded-[14px] border border-border bg-card p-4">
                <p className="font-heading text-lg font-bold">Pro de por vida</p>
                <p className="font-heading text-2xl font-bold text-primary">{eur(PRICES_EUR.pro_lifetime)} <span className="text-sm font-medium text-muted-foreground">pago único</span></p>
                <p className="mt-1 text-xs text-muted-foreground">Pagas una vez. Pro para siempre.</p>
                <div className="mt-3 grow"><FeatureList items={PRO_FEATURES} /></div>
                <Button className="mt-4 w-full" variant="outline" disabled={!!busy} onClick={() => buy("pro_lifetime")}>{busy === "pro_lifetime" ? "Abriendo…" : "Pagar una vez"}</Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
