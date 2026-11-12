"use client"

import { useEffect, useId, useState } from "react"
import { usePathname } from "next/navigation"
import { Envelope } from "@phosphor-icons/react/dist/ssr"
import { AlertCircle, Bug, Lightbulb, Send } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export const OPEN_FEEDBACK_EVENT = "garra:open-feedback"
const MAX = 2000

type Kind = "fallo" | "idea"

const KINDS: { value: Kind; label: string; hint: string; placeholder: string; icon: typeof Bug; tone: string }[] = [
  { value: "fallo", label: "Algo falla", hint: "Un error o algo raro", placeholder: "¿Qué hacías y qué pasó? Por ejemplo: al guardar un gasto desde el iPhone no aparece en Movimientos.", icon: Bug, tone: "text-red-500" },
  { value: "idea", label: "Tengo una idea", hint: "Algo que te gustaría", placeholder: "¿Qué te gustaría que hiciera Garra? Por ejemplo: poder dividir un gasto entre dos personas.", icon: Lightbulb, tone: "text-[var(--gold)]" },
]

/** Abre la hoja «Enviar comentario» desde cualquier pantalla. */
export function openFeedbackDialog(kind?: Kind) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(OPEN_FEEDBACK_EVENT, { detail: { kind } }))
}

export function FeedbackDialog() {
  const pathname = usePathname()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<Kind>("fallo")
  const [message, setMessage] = useState("")
  const [attachPage, setAttachPage] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const textId = useId()

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ kind?: Kind }>).detail
      if (detail?.kind) setKind(detail.kind)
      setError("")
      setOpen(true)
    }
    window.addEventListener(OPEN_FEEDBACK_EVENT, handler)
    return () => window.removeEventListener(OPEN_FEEDBACK_EVENT, handler)
  }, [])

  const current = KINDS.find((k) => k.value === kind) ?? KINDS[0]
  const trimmed = message.trim()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (trimmed.length < 3) { setError("Escribe un poco más para que podamos entenderlo."); return }
    setSending(true)
    setError("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message: trimmed, page: attachPage ? pathname : null }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(body?.error ?? "No se pudo enviar. Inténtalo de nuevo."); return }
      setOpen(false)
      setMessage("")
      toast("¡Gracias! Hemos recibido tu comentario", "success")
    } catch {
      setError("Sin conexión. Inténtalo de nuevo cuando tengas internet.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="z-[70] sm:max-w-md max-sm:bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] max-sm:max-h-[calc(100svh-var(--bottom-nav-h)-env(safe-area-inset-top)-env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle className="text-lg">Enviar comentario</DialogTitle>
          <DialogDescription>Cuéntanos un fallo o una idea. Lo leemos todo y nos ayuda a mejorar Garra.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div role="radiogroup" aria-label="Tipo de comentario" className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => {
              const Icon = k.icon
              const active = k.value === kind
              return (
                <button
                  key={k.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setKind(k.value)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition-all active:scale-[0.98]",
                    active ? "border-primary/40 bg-primary/10 shadow-sm" : "border-border bg-card hover:bg-muted/60",
                  )}
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-background/60" : "bg-muted")}>
                    <Icon className={cn("size-5", active ? k.tone : "text-muted-foreground")} />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("block text-sm font-semibold leading-tight", active ? "text-foreground" : "text-muted-foreground")}>{k.label}</span>
                    <span className="mt-0.5 block truncate text-[11px] leading-tight text-muted-foreground">{k.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor={textId} className="text-sm font-medium text-foreground">{kind === "fallo" ? "¿Qué ha pasado?" : "¿Cuál es tu idea?"}</label>
              <span className={cn("text-[11px] tabular-nums", message.length > MAX * 0.9 ? "text-amber-500" : "text-muted-foreground")}>{message.length}/{MAX}</span>
            </div>
            <textarea
              id={textId}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX))}
              placeholder={current.placeholder}
              rows={5}
              className="w-full resize-none rounded-xl border border-input bg-transparent px-3 py-2.5 text-base leading-6 outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30"
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5">
            <input type="checkbox" checked={attachPage} onChange={(e) => setAttachPage(e.target.checked)} className="mt-0.5 size-4 accent-[var(--gold)]" />
            <span className="min-w-0 text-sm">
              <span className="block font-medium text-foreground">Adjuntar la página en la que estás</span>
              <span className="block truncate text-xs text-muted-foreground">{pathname}{attachPage ? "" : " · no se enviará"}</span>
            </span>
          </label>

          {error && (
            <p className="flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" className="h-11 gap-2 px-6" disabled={sending || trimmed.length < 3}>
              <Send className="size-4" />{sending ? "Enviando…" : "Enviar"}
            </Button>
          </div>
        </form>
        <div className="flex items-start gap-2.5 border-t border-border pt-3.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[var(--gold)]">
            <Envelope weight="regular" className="size-4" />
          </span>
          <p className="text-[13px] leading-snug text-muted-foreground">
            ¿Prefieres escribirnos?{" "}
            <a href="mailto:contacto@migarra.app" className="font-semibold text-[var(--gold)] hover:underline">
              contacto@migarra.app
            </a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
