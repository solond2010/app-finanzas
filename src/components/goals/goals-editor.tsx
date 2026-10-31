"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Plus, Trash2 } from "@/components/icons"
import { useToast } from "@/components/ui/toast"
import { OPEN_GOALS_EDITOR_EVENT, useWealthGoals } from "@/lib/use-wealth-goals"
import { MAX_GOAL_NAME, MAX_WEALTH_GOALS, cleanGoalName, parseEuroInput, sortGoals, type WealthGoal } from "@/lib/wealth-goals"

type Row = { key: string; id: string | null; amount: string; name: string }

const fmt = (n: number) => n.toLocaleString("es-ES", { useGrouping: "always", maximumFractionDigits: 2 })
const newKey = () => Math.random().toString(36).slice(2, 10)
const toRows = (goals: WealthGoal[]): Row[] => sortGoals(goals).map((g) => ({ key: g.id, id: g.id, amount: fmt(g.amount), name: g.name ?? "" }))

/** «Editar objetivos»: el usuario pone sus propios objetivos de patrimonio. */
export function GoalsEditor() {
  const { goals, save } = useWealthGoals()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const handler = () => {
      const initial = toRows(goals)
      setRows(initial.length ? initial : [{ key: newKey(), id: null, amount: "", name: "" }])
      setError("")
      setOpen(true)
    }
    window.addEventListener(OPEN_GOALS_EDITOR_EVENT, handler)
    return () => window.removeEventListener(OPEN_GOALS_EDITOR_EVENT, handler)
  }, [goals])

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const remove = (key: string) => setRows((rs) => rs.filter((r) => r.key !== key))
  const add = () => setRows((rs) => [...rs, { key: newKey(), id: null, amount: "", name: "" }])

  const submit = async () => {
    const filled = rows.filter((r) => r.amount.trim() || r.name.trim())
    const next: WealthGoal[] = []
    for (const r of filled) {
      const amount = parseEuroInput(r.amount)
      if (amount === null) { setError(`«${r.amount || r.name}» no es un importe válido. Escribe, por ejemplo, 5.000.`); return }
      next.push({ id: r.id ?? `obj_${newKey()}${newKey()}`, amount, name: cleanGoalName(r.name) })
    }
    const amounts = new Set<number>()
    for (const g of next) {
      if (amounts.has(g.amount)) { setError(`Hay dos objetivos de ${fmt(g.amount)} €. Deja solo uno.`); return }
      amounts.add(g.amount)
    }
    if (next.length > MAX_WEALTH_GOALS) { setError(`Puedes tener hasta ${MAX_WEALTH_GOALS} objetivos.`); return }
    setSaving(true)
    try {
      await save(next)
      setOpen(false)
      toast(next.length ? "Objetivos guardados" : "Objetivos borrados", "success")
    } catch {
      setError("No se han podido guardar. Revisa tu conexión y vuelve a intentarlo.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) setOpen(o) }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Editar objetivos</DialogTitle>
          <DialogDescription>Las cifras de patrimonio que quieres alcanzar. Ponles nombre si quieres; se ordenan solos de menor a mayor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2" role="list" aria-label="Tus objetivos">
          {rows.map((r, i) => (
            <div key={r.key} role="listitem" className="flex items-center gap-2">
              <div className="relative w-[38%] shrink-0 sm:w-36">
                <Input
                  value={r.amount}
                  onChange={(e) => update(r.key, { amount: e.target.value })}
                  onBlur={() => { const n = parseEuroInput(r.amount); if (n !== null) update(r.key, { amount: fmt(n) }) }}
                  inputMode="decimal"
                  placeholder="5.000"
                  aria-label={`Importe del objetivo ${i + 1}`}
                  className="pr-7 text-right tabular-nums"
                />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
              </div>
              <Input
                value={r.name}
                onChange={(e) => update(r.key, { name: e.target.value.slice(0, MAX_GOAL_NAME) })}
                placeholder="Nombre"
                aria-label={`Nombre del objetivo ${i + 1}`}
                className="min-w-0 flex-1"
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(r.key)} aria-label={`Quitar objetivo ${i + 1}`} className="shrink-0 text-muted-foreground hover:text-red-500">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && <p className="rounded-xl border border-dashed border-border/70 px-3 py-4 text-center text-xs text-muted-foreground">Sin objetivos. Añade uno o guarda así para no ver ninguno.</p>}
        </div>

        <Button type="button" variant="outline" onClick={add} disabled={rows.length >= MAX_WEALTH_GOALS} className="w-full gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Añadir objetivo
        </Button>

        {error && (
          <p role="alert" className="flex items-start gap-1.5 text-xs text-red-500"><AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{error}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Guardar objetivos"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
