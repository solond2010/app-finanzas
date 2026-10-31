"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Sensitive } from "@/components/shared/sensitive"
import { useToast } from "@/components/ui/toast"
import { openGoalsEditor, useWealthGoals } from "@/lib/use-wealth-goals"
import { suggestedGoalAmounts } from "@/lib/wealth-goals"
import { cn } from "@/lib/utils"

const label = (n: number) => `${n.toLocaleString("es-ES", { useGrouping: "always", maximumFractionDigits: 0 })} €`

/** Sin objetivos: propone unos según el patrimonio y deja elegir los propios. */
export function GoalsEmpty({ netWorth, compact = false }: { netWorth: number; compact?: boolean }) {
  const { save } = useWealthGoals()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const suggestion = suggestedGoalAmounts(netWorth, compact ? 3 : 5)

  const accept = async () => {
    setSaving(true)
    try {
      await save(suggestedGoalAmounts(netWorth, 5).map((amount) => ({ id: `obj_${amount}`, amount, name: null })))
      toast("Objetivos guardados. Puedes cambiarlos cuando quieras.", "success")
    } catch {
      toast("No se han podido guardar los objetivos", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn("rounded-xl border border-dashed border-primary/30 bg-primary/[0.04]", compact ? "p-3" : "p-4")}>
      <p className="text-sm font-semibold text-foreground">Ponte tus objetivos</p>
      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
        Elige las cifras de patrimonio que quieres alcanzar. Según lo que tienes ahora te sugerimos:
      </p>
      <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Objetivos sugeridos">
        {suggestion.map((amount) => (
          <span key={amount} className="rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-foreground"><Sensitive>{label(amount)}</Sensitive></span>
        ))}
        {compact && <span className="px-1 py-1 text-[11px] text-muted-foreground">…</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={accept} disabled={saving}>{saving ? "Guardando…" : "Usar la sugerencia"}</Button>
        <Button size="sm" variant="outline" onClick={openGoalsEditor}>Elegir los míos</Button>
      </div>
    </div>
  )
}
