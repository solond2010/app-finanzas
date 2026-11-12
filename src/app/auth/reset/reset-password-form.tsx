"use client"

import { useEffect, useState, type FormEvent } from "react"
import { Loader2 } from "@/components/icons"
import { GarraLogo } from "@/components/brand/garra-logo"
import { PasswordInput } from "@/components/ui/password-input"
import { parseRecoveryHash } from "@/lib/auth-reset-hash"

const inputClass =
  "flex h-12 w-full rounded-xl border border-input bg-background/60 px-4 text-sm ring-1 ring-border/25 transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"

const EXPIRED = "Este enlace ya se usó o ha caducado. Pide otro desde «¿Olvidaste la contraseña?»."

export function ResetPasswordForm() {
  const [status, setStatus] = useState<"checking" | "ready" | "error">("checking")
  const [password, setPassword] = useState("")
  const [repeat, setRepeat] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        const parsed = parseRecoveryHash(window.location.hash)
        if (parsed && "error" in parsed) {
          if (!cancelled) {
            setError(EXPIRED)
            setStatus("error")
          }
          return
        }
        if (parsed && "accessToken" in parsed) {
          const res = await fetch("/api/auth/recovery/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: parsed.accessToken, refresh_token: parsed.refreshToken }),
          })
          history.replaceState(null, "", window.location.pathname + window.location.search)
          if (!res.ok) {
            const body = await res.json().catch(() => null)
            if (!cancelled) {
              setError(body?.error ?? EXPIRED)
              setStatus("error")
            }
            return
          }
          if (!cancelled) setStatus("ready")
          return
        }
        const me = await fetch("/api/auth/me")
        if (cancelled) return
        if (me.ok) {
          setStatus("ready")
          return
        }
        setError(EXPIRED)
        setStatus("error")
      } catch {
        if (!cancelled) {
          setError("Error de conexión. Verifica tu red e inténtalo de nuevo.")
          setStatus("error")
        }
      }
    }
    void boot()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== repeat) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? "No se pudo guardar la contraseña. Inténtalo de nuevo.")
        return
      }
      window.location.href = "/dashboard"
    } catch {
      setError("Error de conexión. Verifica tu red e inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = password.length >= 8 && password === repeat && !loading

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      <div className="relative hero-panel w-full max-w-sm rounded-[16px] p-8">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <div className="flex items-center justify-center">
            <GarraLogo tagline />
          </div>
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-bold tracking-tight">Nueva contraseña</h1>
            <p className="text-sm text-muted-foreground">
              {status === "checking" ? "Comprobando el enlace…" : "Elige una contraseña de al menos 8 caracteres."}
            </p>
          </div>
          {status === "checking" && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-4">
              <p className="text-center text-sm font-medium text-destructive" role="alert">{error}</p>
              <a href="/login" className="text-sm font-medium text-primary hover:underline">Volver a iniciar sesión</a>
            </div>
          )}
          {status === "ready" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <PasswordInput
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Contraseña (mínimo 8 caracteres)"
                disabled={loading}
                required
                autoFocus
              />
              <PasswordInput
                autoComplete="new-password"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className={inputClass}
                placeholder="Repite la contraseña"
                disabled={loading}
                required
              />
              {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar y entrar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
