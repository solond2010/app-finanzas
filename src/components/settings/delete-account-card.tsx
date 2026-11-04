"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, Download, Trash2 } from "@/components/icons"

const WORD = "BORRAR"

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<"export" | "confirm">("export")
  const [typed, setTyped] = useState("")
  const [busy, setBusy] = useState(false)
  const [exported, setExported] = useState(false)
  const [error, setError] = useState("")

  const reset = (v: boolean) => { setOpen(v); if (!v) { setStep("export"); setTyped(""); setError(""); setBusy(false) } }

  const download = async () => {
    setError("")
    try {
      const res = await fetch("/api/backup", { cache: "no-store" })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `garra-mis-datos_${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setExported(true)
    } catch {
      setError("No se pudo descargar la copia. Puedes intentarlo otra vez o seguir sin ella.")
    }
  }

  const remove = async () => {
    if (typed.trim() !== WORD) return
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: WORD }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) throw new Error(body?.error ?? "No se pudo borrar la cuenta")
      // Se olvida también lo guardado en este dispositivo (cachés y cola de guardado).
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      window.location.href = "/login?aviso=cuenta-borrada"
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo borrar la cuenta")
      setBusy(false)
    }
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Trash2 className="size-4 text-destructive" />Borrar mi cuenta</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">Borra para siempre tu cuenta y todos tus datos: cuentas, movimientos, inversiones, objetivos y ajustes. No se puede deshacer.</p>
        <Button variant="destructive" size="sm" onClick={() => reset(true)}><Trash2 className="mr-1.5 size-3.5" />Borrar mi cuenta…</Button>
      </CardContent>
      <Dialog open={open} onOpenChange={reset}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{step === "export" ? "Antes de borrar" : "¿Seguro que quieres borrarlo todo?"}</DialogTitle>
            <DialogDescription>
              {step === "export"
                ? "Si quieres, descarga primero una copia de todos tus datos (archivo JSON). Después ya no podremos recuperarlos."
                : `Se borrarán tu cuenta y todos tus datos de forma definitiva. Escribe ${WORD} para confirmar.`}
            </DialogDescription>
          </DialogHeader>
          {step === "export" ? (
            <div className="space-y-2">
              <Button variant="outline" className="w-full" onClick={download}><Download className="mr-1.5 size-4" />{exported ? "Copia descargada · descargar otra vez" : "Descargar mis datos (JSON)"}</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder={WORD} autoComplete="off" aria-label={`Escribe ${WORD}`} />
              <p className="flex items-start gap-1.5 text-xs text-destructive"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Esto no se puede deshacer.</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => reset(false)} disabled={busy}>Cancelar</Button>
            {step === "export"
              ? <Button variant="destructive" onClick={() => setStep("confirm")}>Continuar</Button>
              : <Button variant="destructive" onClick={remove} disabled={busy || typed.trim() !== WORD}>{busy ? "Borrando…" : "Borrar definitivamente"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
