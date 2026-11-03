"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { FOUNDER_SPOTS, PRICES_EUR, type CheckoutOption, type Plan } from "@/lib/billing/plans"

type PlanInfo = { enabled: true; plan: Plan; source: string | null; renews: string | null; founderSpotsLeft: number }

const eur = (n: number) => n.toLocaleString("es-ES", { style: "currency", currency: "EUR" })

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

  const label = info.plan === "founder" ? "Fundador · Pro para siempre" : info.plan === "pro" ? (info.source === "early_access" ? "Pro para siempre (usuario de la beta)" : "Pro") : "Gratis"

  return (
    <Card>
      <CardHeader><CardTitle>Tu plan</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm"><span className="font-semibold">{label}</span>{info.plan === "pro" && info.renews && <span className="text-muted-foreground"> · se renueva el {new Date(info.renews).toLocaleDateString("es-ES")}</span>}</p>
        {info.plan === "free" && (
          <>
            <p className="text-sm text-muted-foreground">Pro: cuentas ilimitadas, inversiones, historial de patrimonio, análisis avanzado y exportación.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button disabled={!!busy} onClick={() => buy("pro_monthly")}>{eur(PRICES_EUR.pro_monthly)}/mes</Button>
              <Button disabled={!!busy} variant="outline" onClick={() => buy("pro_yearly")}>{eur(PRICES_EUR.pro_yearly)}/año</Button>
              <Button disabled={!!busy || info.founderSpotsLeft <= 0} variant="outline" onClick={() => buy("founder")}>
                Fundador {eur(PRICES_EUR.founder)}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Fundador: pago único, Pro para siempre. Quedan {info.founderSpotsLeft} de {FOUNDER_SPOTS} plazas.</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
