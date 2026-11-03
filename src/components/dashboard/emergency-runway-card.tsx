"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Check, PencilLine, ShieldCheck } from "@/components/icons"
import { Sensitive } from "@/components/shared/sensitive"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { formatMoney } from "@/lib/currency"
import { getSetting, setSetting } from "@/lib/settings"

const SETTING_KEY = "emergency-monthly-living-cost-eur"
const MONTHS_KEY = "emergency-target-months"
const DEFAULT_MONTHS = 6
const MIN_MONTHS = 1
const MAX_MONTHS = 24

function parseMonths(value: string | null | undefined) {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n >= MIN_MONTHS && n <= MAX_MONTHS ? n : 0
}

function parseAmount(value: string | null | undefined) {
  if (!value) return 0
  const amount = Number(value.replace(",", "."))
  return Number.isFinite(amount) && amount > 0 ? amount : 0
}

export function EmergencyRunwayCard({ balanceEur }: { balanceEur: number }) {
  const { toast } = useToast()
  const [monthlyCost, setMonthlyCost] = useState(0)
  const [draft, setDraft] = useState("")
  const [editing, setEditing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [validationError, setValidationError] = useState("")
  const [targetMonths, setTargetMonths] = useState(DEFAULT_MONTHS)
  const [monthsDraft, setMonthsDraft] = useState(String(DEFAULT_MONTHS))

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      let local = 0
      try { local = parseAmount(localStorage.getItem(SETTING_KEY)) } catch {}
      if (!cancelled && local > 0) {
        setMonthlyCost(local)
        setDraft(String(local))
      }
      let localMonths = 0
      try { localMonths = parseMonths(localStorage.getItem(MONTHS_KEY)) } catch {}
      if (!cancelled && localMonths) { setTargetMonths(localMonths); setMonthsDraft(String(localMonths)) }
      void getSetting(MONTHS_KEY).then((remote) => {
        const months = parseMonths(remote)
        if (cancelled || !months) return
        setTargetMonths(months)
        setMonthsDraft(String(months))
        try { localStorage.setItem(MONTHS_KEY, String(months)) } catch {}
      }).catch(() => {})
      void getSetting(SETTING_KEY).then(async (remote) => {
        if (cancelled) return
        const cloudValue = parseAmount(remote)
        if (cloudValue > 0) {
          setMonthlyCost(cloudValue)
          setDraft(String(cloudValue))
          try { localStorage.setItem(SETTING_KEY, String(cloudValue)) } catch {}
        } else if (remote === null && local > 0) {
          // Un dato local pendiente se sincroniza cuando vuelve a estar disponible Supabase.
          await setSetting(SETTING_KEY, String(local))
        }
        setLoaded(true)
      }).catch(() => { if (!cancelled) setLoaded(true) })
    })
    return () => { cancelled = true }
  }, [])

  const coveredMonths = monthlyCost > 0 ? Math.max(0, balanceEur / monthlyCost) : 0
  const visibleMonths = Math.min(coveredMonths, targetMonths)

  async function saveMonthlyCost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = parseAmount(draft)
    if (value <= 0) {
      setValidationError("Introduce un gasto mensual mayor que 0 €.")
      return
    }
    const months = parseMonths(monthsDraft)
    if (!months) {
      setValidationError(`El objetivo debe estar entre ${MIN_MONTHS} y ${MAX_MONTHS} meses.`)
      return
    }
    setTargetMonths(months)
    try { localStorage.setItem(MONTHS_KEY, String(months)) } catch {}
    void setSetting(MONTHS_KEY, String(months)).catch(() => {})

    setSaving(true)
    setValidationError("")
    let localSaved = false
    try {
      localStorage.setItem(SETTING_KEY, String(value))
      localSaved = true
    } catch {}

    try {
      const cloudSaved = await setSetting(SETTING_KEY, String(value))
      if (cloudSaved || localSaved) {
        setMonthlyCost(value)
        setEditing(false)
        toast(
          cloudSaved ? "Gasto mensual guardado y sincronizado." : "Guardado en este dispositivo; se sincronizará cuando vuelva la conexión.",
          cloudSaved ? "success" : "info"
        )
      } else {
        setValidationError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.")
        toast("No se pudo guardar el gasto mensual.", "error")
      }
    } catch {
      if (localSaved) {
        setMonthlyCost(value)
        setEditing(false)
        toast("Guardado en este dispositivo; se sincronizará cuando vuelva la conexión.", "info")
      } else {
        setValidationError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo.")
        toast("No se pudo guardar el gasto mensual.", "error")
      }
    } finally {
      setSaving(false)
    }
  }

  function startEditing() {
    setDraft(monthlyCost > 0 ? String(monthlyCost) : "")
    setMonthsDraft(String(targetMonths))
    setValidationError("")
    setEditing((current) => !current)
  }

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-card p-3.5 transition-colors card-glow sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Colchón de emergencia</p>
        <Button type="button" variant="ghost" size="xs" aria-expanded={editing} disabled={!loaded || saving} onClick={startEditing} className="text-primary">
          {monthlyCost > 0 ? <PencilLine /> : <ShieldCheck />}
          {monthlyCost > 0 ? "Ajustar" : "Configurar"}
        </Button>
      </div>

      {monthlyCost > 0 ? (
        <>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-xl font-bold tracking-tight tabular-nums text-primary sm:text-2xl">
              {coveredMonths.toLocaleString("es-ES", { useGrouping: "always", minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </span>
            <span className="text-xs font-medium text-foreground">meses</span>
            <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">de {targetMonths}</span>
          </div>
          {targetMonths <= 12 ? (
            <div className="mt-2 grid gap-1" style={{ gridTemplateColumns: `repeat(${targetMonths}, minmax(0, 1fr))` }} role="img" aria-label={`${coveredMonths.toLocaleString("es-ES", { useGrouping: "always", maximumFractionDigits: 1 })} meses cubiertos de un objetivo de ${targetMonths}`}>
              {Array.from({ length: targetMonths }, (_, index) => {
                const segment = Math.max(0, Math.min(1, visibleMonths - index))
                return (
                  <div key={index} className="space-y-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${segment * 100}%` }} />
                    </div>
                    {(targetMonths <= 6 || (index + 1) % 3 === 0) && <p className="text-center text-[9px] leading-none tabular-nums text-muted-foreground">{index + 1}m</p>}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="mt-2 space-y-1" role="img" aria-label={`${coveredMonths.toLocaleString("es-ES", { useGrouping: "always", maximumFractionDigits: 1 })} meses cubiertos de un objetivo de ${targetMonths}`}>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${(visibleMonths / targetMonths) * 100}%` }} />
              </div>
              <div className="flex justify-between text-[9px] leading-none tabular-nums text-muted-foreground"><span>0</span><span>{Math.round(targetMonths / 2)}m</span><span>{targetMonths}m</span></div>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="truncate">Saldo: <Sensitive>{formatMoney(balanceEur, "EUR")}</Sensitive></span>
            <span className="shrink-0">Coste: <Sensitive>{formatMoney(monthlyCost, "EUR")}</Sensitive>/mes</span>
          </div>
          {coveredMonths >= targetMonths && <p className="mt-1 text-[10px] font-medium text-emerald-500">Objetivo de {targetMonths} {targetMonths === 1 ? "mes" : "meses"} cubierto</p>}
        </>
      ) : (
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{loaded ? "Define tu coste de vida" : "Cargando tu objetivo…"}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">Saldo de emergencia: <Sensitive>{formatMoney(balanceEur, "EUR")}</Sensitive></p>
          </div>
        </div>
      )}

      {editing && (
        <form onSubmit={saveMonthlyCost} className="mt-3 space-y-2 border-t border-border/70 pt-3">
          <label htmlFor="emergency-monthly-living-cost" className="block text-xs font-medium text-foreground">¿Cuánto necesitas para vivir al mes?</label>
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                id="emergency-monthly-living-cost"
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={draft}
                onChange={(event) => { setDraft(event.target.value); setValidationError("") }}
                aria-invalid={Boolean(validationError)}
                aria-describedby={validationError ? "emergency-monthly-living-cost-error" : undefined}
                placeholder="Ej. 900"
                className="h-9 pr-8 tabular-nums"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">€</span>
            </div>
            <Button type="submit" size="sm" disabled={saving || !loaded} className="shrink-0">
              <Check /> Guardar
            </Button>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <label htmlFor="emergency-target-months" className="text-xs font-medium text-foreground">¿Cuántos meses quieres cubrir?</label>
            <div className="flex items-center gap-1">
              <Button type="button" variant="outline" size="icon-sm" aria-label="Un mes menos" onClick={() => setMonthsDraft((v) => String(Math.max(MIN_MONTHS, (parseMonths(v) || DEFAULT_MONTHS) - 1)))}>−</Button>
              <Input
                id="emergency-target-months"
                type="number"
                min={MIN_MONTHS}
                max={MAX_MONTHS}
                step={1}
                inputMode="numeric"
                value={monthsDraft}
                onChange={(event) => { setMonthsDraft(event.target.value); setValidationError("") }}
                className="h-8 w-14 text-center tabular-nums"
              />
              <Button type="button" variant="outline" size="icon-sm" aria-label="Un mes más" onClick={() => setMonthsDraft((v) => String(Math.min(MAX_MONTHS, (parseMonths(v) || DEFAULT_MONTHS) + 1)))}>+</Button>
            </div>
          </div>
          {validationError ? <p id="emergency-monthly-living-cost-error" role="alert" className="text-xs text-destructive">{validationError}</p> : (
            <p className="text-[10px] text-muted-foreground">El importe se guarda en tu cuenta y sirve para calcular los meses cubiertos.</p>
          )}
        </form>
      )}
    </div>
  )
}
