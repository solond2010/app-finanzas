"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Bug, ChatText, Check, Lightbulb, RotateCcw } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/shared/skeleton"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"

type FeedbackRow = { id: string; kind: "fallo" | "idea"; message: string; page: string | null; email: string | null; user_agent: string | null; status: "nuevo" | "visto" | "hecho"; created_at: string }
type ErrorRow = { id: number; source: "navegador" | "servidor"; route: string | null; message: string; stack: string | null; digest: string | null; user_agent: string | null; user_id: string | null; created_at: string }
type Data = { feedback: FeedbackRow[]; errors: ErrorRow[]; errors24h: number }

const when = (value: string) => new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" })
const device = (ua: string | null) => !ua ? "—" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Otro"

/** Sección oculta (no está en el menú): solo la ve Moha. */
export default function AdminPage() {
  const { toast } = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading")
  const [tab, setTab] = useState<"comentarios" | "errores">("comentarios")
  const [openError, setOpenError] = useState<number | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" }).catch(() => null)
    if (!res) { setState("error"); return }
    if (res.status === 404 || res.status === 401) { setState("forbidden"); return }
    if (!res.ok) { setState("error"); return }
    setData(await res.json())
    setState("ok")
  }, [])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])

  async function mark(id: string, status: FeedbackRow["status"]) {
    const res = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    if (!res.ok) { toast("No se pudo actualizar", "error"); return }
    setData((d) => d && { ...d, feedback: d.feedback.map((f) => (f.id === id ? { ...f, status } : f)) })
  }

  if (state === "forbidden") {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Página no encontrada</h1>
        <Link href="/dashboard" className="text-sm font-medium text-primary">Volver al inicio</Link>
      </div>
    )
  }

  const nuevos = data?.feedback.filter((f) => f.status === "nuevo").length ?? 0

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/configuracion" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Configuración</Link>
          <p className="page-section-label">Solo tú</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Administración</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lo que te cuentan los usuarios y los errores que ha tenido la app.</p>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={() => { setState("loading"); void load() }}><RotateCcw className="size-4" />Actualizar</Button>
      </header>

      <div role="tablist" aria-label="Secciones de administración" className="inline-flex rounded-full bg-muted/60 p-1 text-sm font-semibold">
        {([["comentarios", `Comentarios${nuevos ? ` · ${nuevos} nuevos` : ""}`], ["errores", `Errores${data ? ` · ${data.errors24h} hoy` : ""}`]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("min-h-10 rounded-full px-4 transition-colors sm:px-5", tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {state === "loading" && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {state === "error" && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">No se pudo cargar. Prueba con «Actualizar».</p>}

      {state === "ok" && data && tab === "comentarios" && (
        data.feedback.length === 0 ? (
          <Card className="border border-border"><CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><ChatText className="size-5" />Aún no hay comentarios.</CardContent></Card>
        ) : (
          <ul className="space-y-3">
            {data.feedback.map((f) => (
              <li key={f.id}>
                <Card className={cn("border", f.status === "nuevo" ? "border-primary/30" : "border-border")}>
                  <CardHeader className="pb-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {f.kind === "fallo" ? <Bug className="size-4 text-red-500" /> : <Lightbulb className="size-4 text-[var(--gold)]" />}
                      {f.kind === "fallo" ? "Fallo" : "Idea"}
                      <span className="font-normal text-muted-foreground">· {f.email ?? "usuario"} · {when(f.created_at)}</span>
                      {f.status === "nuevo" && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Nuevo</span>}
                      {f.status === "hecho" && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-500">Hecho</span>}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{f.message}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Página: {f.page ?? "no adjunta"} · {device(f.user_agent)}</p>
                      <div className="flex gap-2">
                        {f.status !== "visto" && f.status !== "hecho" && <Button size="sm" variant="outline" onClick={() => void mark(f.id, "visto")}>Marcar visto</Button>}
                        {f.status !== "hecho" && <Button size="sm" className="gap-1.5" onClick={() => void mark(f.id, "hecho")}><Check className="size-3.5" />Hecho</Button>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )
      )}

      {state === "ok" && data && tab === "errores" && (
        data.errors.length === 0 ? (
          <Card className="border border-border"><CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><Check className="size-5 text-emerald-500" />Sin errores registrados.</CardContent></Card>
        ) : (
          <ul className="space-y-2">
            {data.errors.map((e) => (
              <li key={e.id} className="rounded-2xl border border-border bg-card">
                <button type="button" onClick={() => setOpenError(openError === e.id ? null : e.id)} aria-expanded={openError === e.id} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                  <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", e.source === "servidor" ? "text-red-500" : "text-amber-500")} />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-foreground">{e.message}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{e.source === "servidor" ? "Servidor" : "Navegador"} · {e.route ?? "—"} · {device(e.user_agent)} · {when(e.created_at)}</span>
                  </span>
                </button>
                {openError === e.id && (
                  <div className="space-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground">
                    <p>Usuario: {e.user_id ?? "sin sesión"}{e.digest ? ` · Código: ${e.digest}` : ""}</p>
                    {e.stack && <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/50 p-3 font-mono text-[11px] leading-5">{e.stack}</pre>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
