"use client"

import { useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "@/components/icons"
import { GarraLogo } from "@/components/brand/garra-logo"
import { loginNotice } from "@/lib/auth-links"
import { PasswordInput } from "@/components/ui/password-input"
import { DemoEntryButton } from "@/components/demo/demo-entry-button"

type Mode = "login" | "signup" | "magic"

const inputClass =
  "flex h-12 w-full rounded-xl border border-input bg-background/60 px-4 text-sm ring-1 ring-border/25 transition-all placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"

const TITLES: Record<Mode, { title: string; subtitle: string; button: string }> = {
  login: { title: "Entra en tu cuenta", subtitle: "Con tu email y tu contraseña.", button: "Entrar" },
  signup: { title: "Crea tu cuenta", subtitle: "Gratis. Solo tú verás tus datos.", button: "Crear cuenta" },
  magic: { title: "Entrar sin contraseña", subtitle: "Te enviamos un enlace a tu email para entrar.", button: "Enviar enlace" },
}

export function AccountLoginForm() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>(searchParams.get("modo") === "registro" ? "signup" : "login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const notice = loginNotice(searchParams)
  const [error, setError] = useState(notice?.kind === "error" ? notice.text : "")
  const [info, setInfo] = useState(notice?.kind === "info" ? notice.text : "")

  function switchMode(next: Mode) {
    setMode(next)
    setError("")
    setInfo("")
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    setInfo("")
    const endpoint = mode === "login" ? "/api/auth/login" : mode === "signup" ? "/api/auth/signup" : "/api/auth/magic-link"
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "magic" ? { email } : { email, password }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setError(body?.error ?? "No se pudo completar. Inténtalo de nuevo.")
        return
      }
      if (mode === "magic") {
        setInfo("Si hay una cuenta con ese email, te llegará un enlace en unos segundos. Revisa también el spam.")
        return
      }
      if (mode === "signup" && body?.needsConfirmation) {
        setInfo("¡Cuenta creada! Te hemos enviado un email: pulsa el enlace para activarla.")
        return
      }
      const redirect = searchParams.get("redirect") || "/dashboard"
      // Navegación completa: así la app arranca de cero con el nuevo usuario.
      window.location.href = redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/dashboard"
    } catch {
      setError("Error de conexión. Verifica tu red e inténtalo de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  const t = TITLES[mode]
  const canSubmit = email.includes("@") && (mode === "magic" || password.length >= (mode === "signup" ? 8 : 1))

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center justify-center gap-2.5">
        <GarraLogo tagline />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          placeholder="Email"
          autoFocus
          disabled={loading}
          required
        />
        {mode !== "magic" && (
          <PasswordInput
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder={mode === "signup" ? "Contraseña (mínimo 8 caracteres)" : "Contraseña"}
            disabled={loading}
            required
          />
        )}
        {error && <p className="text-sm font-medium text-destructive" role="alert">{error}</p>}
        {info && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">{info}</p>}
        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {t.button}
        </button>
      </form>
      {/* Primera visita: crear cuenta y ver la demo al mismo nivel. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          {mode === "signup" ? "¿Prefieres verla antes?" : "¿Primera vez en Garra?"}
          <span className="h-px flex-1 bg-border" />
        </div>
        {mode === "signup" ? (
          <DemoEntryButton label="Ver demo sin registrarme" />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-background/60 px-3 text-sm font-semibold transition-all hover:bg-muted/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              Crear cuenta
            </button>
            <DemoEntryButton />
          </div>
        )}
        <p className="text-center text-xs text-muted-foreground">La demo tiene datos ficticios y no necesita email.</p>
      </div>
      <div className="flex flex-col items-center gap-2 text-sm">
        {mode !== "login" && <button type="button" className="text-primary hover:underline" onClick={() => switchMode("login")}>Ya tengo cuenta: entrar</button>}
        {mode !== "magic" && <button type="button" className="text-muted-foreground hover:underline" onClick={() => switchMode("magic")}>¿Olvidaste la contraseña? Entra con un enlace por email</button>}
      </div>
    </div>
  )
}
