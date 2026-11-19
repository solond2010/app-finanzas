"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowLeft, Bug, ChatText, Check, Lightbulb, RotateCcw, Search, UserRound } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/shared/skeleton"
import { useToast } from "@/components/ui/toast"
import { cn } from "@/lib/utils"
import {
  ADMIN_PLAN_LABELS,
  ADMIN_USERS_PAGE_SIZE,
  filterAdminUsers,
  paginateAdminUsers,
  type AdminPlanKind,
  type AdminUserRow,
} from "@/lib/admin-users"

type FeedbackRow = { id: string; user_id: string | null; kind: "fallo" | "idea"; message: string; page: string | null; email: string | null; user_agent: string | null; status: "nuevo" | "visto" | "hecho"; created_at: string }
type ErrorRow = { id: number; source: "navegador" | "servidor"; route: string | null; message: string; stack: string | null; digest: string | null; user_agent: string | null; user_id: string | null; created_at: string }
type Data = { feedback: FeedbackRow[]; errors: ErrorRow[]; errors24h: number }
type UsersData = { users: AdminUserRow[]; totals: { users: number; pro: number; paying: number } }
type Tab = "usuarios" | "comentarios" | "errores"

const when = (value: string) => new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" })
const whenDate = (value: string) => value ? new Date(value).toLocaleDateString("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" }) : "—"
const device = (ua: string | null) => !ua ? "—" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac OS/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Otro"

const PLAN_BADGE: Record<AdminPlanKind, string> = {
  free: "bg-muted text-muted-foreground",
  monthly: "bg-primary/15 text-primary",
  lifetime: "bg-[var(--gold)]/15 text-[var(--gold)]",
  first_fifty: "bg-sky-500/15 text-sky-400",
  early_access: "bg-violet-500/15 text-violet-400",
}

export default function AdminDashboard() {
  const { toast } = useToast()
  const [data, setData] = useState<Data | null>(null)
  const [usersData, setUsersData] = useState<UsersData | null>(null)
  const [state, setState] = useState<"loading" | "ok" | "forbidden" | "error">("loading")
  const [usersState, setUsersState] = useState<"idle" | "loading" | "ok" | "error">("idle")
  const [tab, setTab] = useState<Tab>("usuarios")
  const [openError, setOpenError] = useState<number | null>(null)
  const [replying, setReplying] = useState<FeedbackRow | null>(null)
  const [replyMessage, setReplyMessage] = useState("")
  const [savingReply, setSavingReply] = useState(false)
  const [userQuery, setUserQuery] = useState("")
  const [userPage, setUserPage] = useState(1)

  const load = useCallback(async () => {
    const res = await fetch("/api/admin", { cache: "no-store" }).catch(() => null)
    if (!res) { setState("error"); return }
    if (res.status === 404 || res.status === 401 || res.status === 403) { setState("forbidden"); return }
    if (!res.ok) { setState("error"); return }
    setData(await res.json())
    setState("ok")
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersState("loading")
    const res = await fetch("/api/admin/usuarios", { cache: "no-store" }).catch(() => null)
    if (!res || res.status === 404 || res.status === 401 || res.status === 403) { setUsersState("error"); return }
    if (!res.ok) { setUsersState("error"); return }
    setUsersData(await res.json())
    setUsersState("ok")
  }, [])

  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useEffect(() => { queueMicrotask(() => void loadUsers()) }, [loadUsers])
  useEffect(() => { setUserPage(1) }, [userQuery])

  const filteredUsers = useMemo(
    () => filterAdminUsers(usersData?.users ?? [], userQuery),
    [usersData, userQuery],
  )
  const pagedUsers = useMemo(
    () => paginateAdminUsers(filteredUsers, userPage, ADMIN_USERS_PAGE_SIZE),
    [filteredUsers, userPage],
  )

  async function mark(id: string, status: FeedbackRow["status"]) {
    const res = await fetch("/api/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) })
    if (!res.ok) { toast("No se pudo actualizar", "error"); return }
    setData((d) => d && { ...d, feedback: d.feedback.map((f) => (f.id === id ? { ...f, status } : f)) })
  }

  async function completeFeedback() {
    if (!replying || savingReply) return
    const message = replyMessage.trim()
    if (replying.user_id && (message.length < 3 || message.length > 2000)) {
      toast("Escribe una respuesta de entre 3 y 2000 caracteres", "error")
      return
    }
    setSavingReply(true)
    const res = await fetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: replying.id, status: "hecho", ...(replying.user_id ? { message } : {}) }),
    }).catch(() => null)
    const body = await res?.json().catch(() => null)
    setSavingReply(false)
    if (!res?.ok) { toast(body?.error ?? "No se pudo actualizar", "error"); return }
    setData((d) => d && { ...d, feedback: d.feedback.map((f) => (f.id === replying.id ? { ...f, status: "hecho" } : f)) })
    setReplying(null)
    setReplyMessage("")
    toast(replying.user_id ? "Respuesta enviada y comentario marcado como hecho" : "Comentario marcado como hecho", "success")
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
  const tabs: [Tab, string][] = [
    ["usuarios", `Usuarios${usersData ? ` · ${usersData.totals.users}` : ""}`],
    ["comentarios", `Comentarios${nuevos ? ` · ${nuevos} nuevos` : ""}`],
    ["errores", `Errores${data ? ` · ${data.errors24h} hoy` : ""}`],
  ]

  return (
    <div className="content-fade space-y-6 sm:space-y-7">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href="/configuracion" className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Configuración</Link>
          <p className="page-section-label">Solo tú</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Administración</h1>
          <p className="mt-1 text-sm text-muted-foreground">Usuarios, comentarios y los errores que ha tenido la app.</p>
        </div>
        <Button variant="outline" className="gap-2 self-start sm:self-auto" onClick={() => { setState("loading"); void load(); void loadUsers() }}><RotateCcw className="size-4" />Actualizar</Button>
      </header>

      <div role="tablist" aria-label="Secciones de administración" className="grid w-full grid-cols-3 rounded-2xl bg-muted/60 p-1 text-sm font-semibold sm:inline-flex sm:w-auto sm:rounded-full">
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("min-h-10 truncate rounded-xl px-2 transition-colors sm:rounded-full sm:px-5", tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>
        ))}
      </div>

      {tab === "usuarios" && (
        <UsersPanel
          state={usersState}
          data={usersData}
          query={userQuery}
          onQuery={setUserQuery}
          paged={pagedUsers}
          onPage={setUserPage}
        />
      )}

      {state === "loading" && tab !== "usuarios" && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {state === "error" && tab !== "usuarios" && <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">No se pudo cargar. Prueba con «Actualizar».</p>}

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
                        {f.status !== "hecho" && <Button size="sm" className="gap-1.5" onClick={() => { setReplyMessage(""); setReplying(f) }}><Check className="size-3.5" />Hecho</Button>}
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

      <Dialog open={replying !== null} onOpenChange={(open) => { if (!open && !savingReply) setReplying(null) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{replying?.user_id ? "Responder y marcar como hecho" : "Marcar comentario como hecho"}</DialogTitle>
            <DialogDescription>
              {replying?.user_id
                ? "El usuario recibirá este mensaje en sus notificaciones dentro de Garra."
                : "Este comentario es anónimo y no tiene una cuenta donde recibir una respuesta privada."}
            </DialogDescription>
          </DialogHeader>
          {replying?.user_id ? (
            <div className="space-y-2">
              <label htmlFor="feedback-reply" className="text-sm font-medium">Mensaje para el usuario</label>
              <textarea
                id="feedback-reply"
                value={replyMessage}
                onChange={(event) => setReplyMessage(event.target.value.slice(0, 2000))}
                placeholder="Cuéntale qué se ha hecho o responde a su comentario…"
                maxLength={2000}
                rows={5}
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm leading-6 outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              <p className="text-right text-xs text-muted-foreground">{replyMessage.trim().length}/2000</p>
            </div>
          ) : (
            <p className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground">Puedes cerrarlo aquí; no se enviará ninguna notificación al visitante.</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={savingReply} onClick={() => setReplying(null)}>Cancelar</Button>
            <Button type="button" disabled={savingReply || Boolean(replying?.user_id && replyMessage.trim().length < 3)} onClick={() => void completeFeedback()}>
              <Check className="size-4" />
              {savingReply ? "Guardando…" : replying?.user_id ? "Enviar respuesta" : "Marcar como hecho"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function UsersPanel({
  state,
  data,
  query,
  onQuery,
  paged,
  onPage,
}: {
  state: "idle" | "loading" | "ok" | "error"
  data: UsersData | null
  query: string
  onQuery: (value: string) => void
  paged: { items: AdminUserRow[]; page: number; pages: number; total: number }
  onPage: (page: number) => void
}) {
  if (state === "loading" || state === "idle") {
    return <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
  }
  if (state === "error" || !data) {
    return <p className="rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">No se pudo cargar la lista de usuarios. Prueba con «Actualizar».</p>
  }

  const totals = data.totals

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Usuarios" value={totals.users} />
        <StatCard label="Con Pro" value={totals.pro} />
        <StatCard label="De pago" value={totals.paying} />
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Buscar por email o plan…" className="h-11 pl-9" aria-label="Buscar usuarios" />
      </div>
      {paged.total === 0 ? (
        <Card className="border border-border"><CardContent className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><UserRound className="size-5" />{query.trim() ? "Nadie coincide con esa búsqueda." : "Aún no hay usuarios."}</CardContent></Card>
      ) : (
        <>
          <ul className="space-y-2 sm:hidden">
            {paged.items.map((user) => (
              <li key={`${user.email}-${user.created_at}`} className="rounded-2xl border border-border bg-card px-4 py-3">
                <p className="break-all text-sm font-medium text-foreground">{user.email ?? "Sin email"}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <PlanBadge plan={user.plan} />
                  <span className="text-xs text-muted-foreground">{whenDate(user.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Alta</th>
                  <th className="px-4 py-3 font-semibold">Plan</th>
                </tr>
              </thead>
              <tbody>
                {paged.items.map((user) => (
                  <tr key={`${user.email}-${user.created_at}`} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium break-all">{user.email ?? "Sin email"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{whenDate(user.created_at)}</td>
                    <td className="px-4 py-3"><PlanBadge plan={user.plan} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paged.pages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <p>{paged.total} {paged.total === 1 ? "usuario" : "usuarios"}{query.trim() ? " en esta búsqueda" : ""}</p>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" disabled={paged.page <= 1} onClick={() => onPage(paged.page - 1)}>Anterior</Button>
                <span className="tabular-nums">{paged.page} / {paged.pages}</span>
                <Button type="button" size="sm" variant="outline" disabled={paged.page >= paged.pages} onClick={() => onPage(paged.page + 1)}>Siguiente</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border border-border">
      <CardContent className="px-4 py-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      </CardContent>
    </Card>
  )
}

function PlanBadge({ plan }: { plan: AdminPlanKind }) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold", PLAN_BADGE[plan])}>
      {ADMIN_PLAN_LABELS[plan]}
    </span>
  )
}
