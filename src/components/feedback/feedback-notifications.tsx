"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Bell, CheckCircle } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type FeedbackReply = { id: string; feedback_id: string; message: string; created_at: string; read_at: string | null }
type NotificationsContext = { unread: number; openInbox: () => void }

const NotificationsContext = createContext<NotificationsContext | null>(null)
const formatDate = (value: string) => new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })

export function useFeedbackNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error("FeedbackNotificationsProvider is missing")
  return context
}

export function FeedbackNotificationsProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const { toast } = useToast()
  const [responses, setResponses] = useState<FeedbackReply[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [open, setOpen] = useState(false)
  const seenIds = useRef(new Set<string>())

  const openInbox = useCallback(() => setOpen(true), [])

  const refresh = useCallback(async () => {
    const res = await fetch("/api/feedback/responses", { cache: "no-store" }).catch(() => null)
    if (!res?.ok) { setLoadError(true); setLoaded(true); return }
    const body = await res.json().catch(() => null) as { responses?: FeedbackReply[] } | null
    if (!body || !Array.isArray(body.responses)) { setLoadError(true); setLoaded(true); return }
    const next = body.responses
    const unseen = next.filter((reply) => !reply.read_at && !seenIds.current.has(reply.id))
    for (const reply of next) seenIds.current.add(reply.id)
    setResponses(next)
    setLoadError(false)
    setLoaded(true)
    if (unseen.length) {
      const newest = unseen[0]
      const preview = newest.message.length > 90 ? `${newest.message.slice(0, 87).trimEnd()}…` : newest.message
      toast(`Tienes una respuesta del equipo: ${preview}`, "info", { action: { label: "Ver", onClick: openInbox }, duration: 8000 })
    }
  }, [openInbox, toast])

  useEffect(() => {
    if (!enabled) return
    let active = true
    const poll = () => { if (active && document.visibilityState !== "hidden") void refresh() }
    queueMicrotask(poll)
    const interval = window.setInterval(poll, 60_000)
    document.addEventListener("visibilitychange", poll)
    return () => { active = false; window.clearInterval(interval); document.removeEventListener("visibilitychange", poll) }
  }, [enabled, refresh])

  const markRead = useCallback(async (ids: string[]) => {
    if (!ids.length) return
    const res = await fetch("/api/feedback/responses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).catch(() => null)
    if (!res?.ok) { toast("No se pudieron marcar las respuestas como leídas", "error"); return }
    const readAt = new Date().toISOString()
    const changed = new Set(ids)
    setResponses((current) => current.map((reply) => changed.has(reply.id) ? { ...reply, read_at: readAt } : reply))
  }, [toast])

  const unreadIds = useMemo(() => responses.filter((reply) => !reply.read_at).map((reply) => reply.id), [responses])
  const unreadKey = unreadIds.join(",")
  useEffect(() => {
    if (open && loaded && unreadIds.length) void markRead(unreadIds)
  }, [open, loaded, unreadKey, unreadIds, markRead])

  const unread = unreadIds.length

  return (
    <NotificationsContext.Provider value={{ unread, openInbox }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8"><Bell className="size-5 text-[var(--gold)]" />Notificaciones</DialogTitle>
            <DialogDescription>Respuestas del equipo a los comentarios que has enviado.</DialogDescription>
          </DialogHeader>
          {!enabled ? (
            <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Las notificaciones no están disponibles en la demo.</p>
          ) : loadError ? (
            <div className="space-y-3 rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              <p>No se pudieron cargar tus respuestas.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>Reintentar</Button>
            </div>
          ) : !loaded ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Cargando notificaciones…</p>
          ) : responses.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <CheckCircle className="size-8 text-emerald-500" />
              <p className="text-sm font-medium">Todavía no hay respuestas</p>
              <p className="text-xs text-muted-foreground">Te avisaremos aquí cuando el equipo responda a una idea o un fallo.</p>
            </div>
          ) : (
            <ul className="max-h-[55dvh] space-y-3 overflow-y-auto pr-1">
              {responses.map((reply) => (
                <li key={reply.id} className={cn("rounded-xl border p-4", reply.read_at ? "border-border bg-card" : "border-primary/30 bg-primary/[0.04]")}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground"><CheckCircle className="size-4 text-emerald-500" />Comentario atendido</span>
                    {!reply.read_at && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Nueva</span>}
                  </div>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{reply.message}</p>
                  <time className="mt-3 block text-xs text-muted-foreground">{formatDate(reply.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </NotificationsContext.Provider>
  )
}

export function FeedbackNotificationsButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { unread, openInbox } = useFeedbackNotifications()
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "default"}
      onClick={openInbox}
      aria-label={unread ? `Notificaciones, ${unread} sin leer` : "Notificaciones"}
      className={cn("relative justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground", compact && "justify-center", className)}
    >
      <Bell className="size-4 shrink-0" />
      {!compact && <span className="flex-1 text-left">Notificaciones</span>}
      {unread > 0 && <span className={cn("flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-primary-foreground tabular-nums", compact && "absolute -right-0.5 -top-0.5")}>{unread > 99 ? "99+" : unread}</span>}
    </Button>
  )
}
