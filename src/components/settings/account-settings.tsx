"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import { Copy, KeyRound, LogOut, Smartphone, Trash2, UserRound } from "@/components/icons"
import { PasswordInput } from "@/components/ui/password-input"

type Me = { mode: "accounts" | "password"; userId: string; email: string | null }
type TokenItem = { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null }

function formatDate(value: string | null) {
  if (!value) return "nunca"
  return new Date(value).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })
}

/** Cuenta, contraseña y claves de Atajos. Solo aparece con cuentas activadas. */
export function AccountSettings() {
  const { toast } = useToast()
  const [me, setMe] = useState<Me | null>(null)
  const [tokens, setTokens] = useState<TokenItem[]>([])
  const [tokensError, setTokensError] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<string | null>(null)
  const [tokenName, setTokenName] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)

  const loadTokens = useCallback(async () => {
    const res = await fetch("/api/tokens", { cache: "no-store" })
    const body = await res.json().catch(() => null)
    if (!res.ok) { setTokensError(body?.error ?? "No se pudieron cargar las claves"); return }
    setTokensError(null)
    setTokens(body.tokens ?? [])
  }, [])

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" }).catch(() => null)
      const body = res?.ok ? ((await res.json().catch(() => null)) as Me | null) : null
      setMe(body)
      if (body?.mode === "accounts") await loadTokens()
    })()
  }, [loadTokens])

  if (!me || me.mode !== "accounts") return null

  async function createToken() {
    setBusy(true)
    try {
      const res = await fetch("/api/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: tokenName }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { toast(body?.error ?? "No se pudo crear la clave", "error"); return }
      setNewToken(body.token)
      setTokenName("")
      await loadTokens()
    } finally { setBusy(false) }
  }

  async function revokeToken(id: string) {
    if (!window.confirm("¿Revocar esta clave? Los Atajos que la usen dejarán de funcionar.")) return
    const res = await fetch("/api/tokens", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    if (!res.ok) { toast("No se pudo revocar la clave", "error"); return }
    toast("Clave revocada", "success")
    await loadTokens()
  }

  async function changePassword() {
    setBusy(true)
    try {
      const res = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { toast(body?.error ?? "No se pudo cambiar la contraseña", "error"); return }
      setPassword("")
      toast("Contraseña guardada", "success")
    } finally { setBusy(false) }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    window.location.href = "/login"
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><UserRound className="h-4 w-4" />Tu cuenta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="truncate text-sm font-medium">{me.email ?? "—"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-1.5 h-3.5 w-3.5" />Cerrar sesión</Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Cambiar contraseña</p>
            <div className="flex gap-2">
              <PasswordInput className="h-11 w-full min-w-0 rounded-xl border border-input bg-transparent px-3 text-base outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30" autoComplete="new-password" placeholder="Nueva contraseña (mín. 8)" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button size="sm" disabled={busy || password.length < 8} onClick={changePassword}>Guardar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold"><Smartphone className="h-4 w-4" />Claves para Atajos de iPhone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Cada clave deja que un Atajo apunte movimientos en <strong>tu</strong> cuenta. Pégala en el Atajo donde antes iba la clave secreta. Si pierdes el móvil, revócala aquí.</p>
          {newToken && (
            <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-3">
              <p className="text-xs font-medium">Copia esta clave ahora: no se volverá a mostrar.</p>
              <div className="flex gap-2">
                <Input readOnly value={newToken} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Nueva clave" />
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard?.writeText(newToken).then(() => toast("Clave copiada", "success")) }}><Copy className="h-3.5 w-3.5" /></Button>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setNewToken(null)}>Ya la he copiado</Button>
            </div>
          )}
          <div className="flex gap-2">
            <Input placeholder="Nombre (p. ej. iPhone de Moha)" value={tokenName} maxLength={60} onChange={(e) => setTokenName(e.target.value)} />
            <Button size="sm" disabled={busy} onClick={createToken}><KeyRound className="mr-1.5 h-3.5 w-3.5" />Crear clave</Button>
          </div>
          {tokensError ? (
            <p className="text-xs text-destructive">{tokensError}</p>
          ) : tokens.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no tienes claves.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {tokens.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground"><span className="font-mono">{t.prefix}…</span> · creada {formatDate(t.created_at)} · último uso {formatDate(t.last_used_at)}</p>
                  </div>
                  <Button size="sm" variant="ghost" aria-label={`Revocar ${t.name}`} onClick={() => revokeToken(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
